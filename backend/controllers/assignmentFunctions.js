const Assignment = require("../models/assignmentModel");
const { getGeminiFeedback } = require('../services/geminiService');
const { fetchTextData, compareStrings } = require("../functions/fetchTextFromUrl.js");
const { bakersDup } = require("../functions/plagiagrismFunc.js");
const Axios = require('axios');
const User = require("../models/userModel.js");

class AssigmentController {
    async addNewAssignment(assignment) {
        try {
            const newAssignment = new Assignment({
                title: assignment.title,
                question: assignment.question,
                startTime: assignment.startTime,
                endTime: assignment.endTime,
                penaltyTime: assignment.penaltyTime,
                language: assignment.language,
                testCases: [],
                creator_roll: assignment.roll_no,
                submissions: []
            });

            assignment.testCases.forEach((item) => {
                newAssignment.testCases.push({ input: item.name, output: item.link });
            });

            await newAssignment.save();

            for (const range of assignment.users) {
                const start = Number(range.name);
                const end = Number(range.link);
                for (let roll_no = start; roll_no <= end; roll_no++) {
                    try {
                        const user = await User.findOne({ rollNumber: roll_no, role: 0 });
                        if (user) {
                            user.assignments.push(newAssignment._id);
                            await user.save();
                        } else {
                            console.log(`User with roll number ${roll_no} not found or not matching role.`);
                        }
                    } catch (error) {
                        console.error(`Error assigning assignment to user with roll number ${roll_no}: ${error.message}`);
                    }
                }
            }
            return newAssignment._id;
        } catch (err) {
            throw new Error(err);
        }
    }

    async checkAssignments(assignment_id) {
        try {
            const currAssignment = await Assignment.findById(assignment_id);
            const submissions = currAssignment.submissions;
            const testCases = currAssignment.testCases;
            const language = currAssignment.language;
            const testCaseSize = testCases.length;

            let newSubmissions = [];
            let stringArr = [];

            for (const submission of submissions) {
                const file = submission.file;
                const convertedFile = await fetchTextData(file);
                stringArr.push(convertedFile);

                let correctCount = 0;
                for (const testCase of testCases) {
                    const response = await this.checkCode({
                        code: convertedFile,
                        language: language,
                        input: testCase.input,
                        output: testCase.output
                    });

                    if (compareStrings(response, testCase.output)) {
                        correctCount++;
                    }
                }

                const marks = (correctCount * 100.0) / testCaseSize;
                let nextSubmission = submission;

                // ✅ Use Gemini AI for feedback
                const aiFeedback = await getGeminiFeedback({
                    code: convertedFile,
                    language,
                    question: currAssignment.question,
                    isCorrect: marks === 100
                });

                nextSubmission.aiFeedback = aiFeedback;
                nextSubmission.marks = marks;

                newSubmissions.push(nextSubmission);
            }

            const checkedAssignments = await this.checkPlagiarism(language, newSubmissions, stringArr);
            currAssignment.submissions = checkedAssignments;
            await currAssignment.save();

            return currAssignment;
        } catch (err) {
            console.log(err);
            throw new Error(err);
        }
    }

    async checkPlagiarism(language, newAssignments, stringArr) {
        try {
            let assignments = newAssignments;

            for (let i = 0; i < stringArr.length - 1; i++) {
                for (let j = i + 1; j < stringArr.length; j++) {
                    let cheated = bakersDup(stringArr[i], stringArr[j], language);
                    if (cheated) {
                        assignments[i].marks = 0;
                        assignments[i].feedback = 'Plagiarism Detected';
                        assignments[j].marks = 0;
                        assignments[j].feedback = 'Plagiarism Detected';
                        break;
                    }
                }
            }
            return assignments;
        } catch (err) {
            throw new Error(err);
        }
    }

    async checkCode(details) {
        try {
            let { code, language, input } = details;
            if (language === "Python") language = "python3";
            if (language === "C++") language = "cpp";
            if (language === "Dart") language = "dart";
            if (language === "PHP") language = "php";
            if (language === "SQL") language = "sql";

            const options = {
                method: 'POST',
                url: 'https://online-code-compiler.p.rapidapi.com/v1/',
                headers: {
                    'content-type': 'application/json',
                    'X-RapidAPI-Key': 'YOUR_RAPIDAPI_KEY',
                    'X-RapidAPI-Host': 'online-code-compiler.p.rapidapi.com'
                },
                data: {
                    language: language,
                    version: 'latest',
                    code: code,
                    input: input
                }
            };

            const response = await Axios(options);
            return response.data.output;
        } catch (err) {
            throw new Error(err);
        }
    }

    async addSubmission(submission, assignment_id) {
        try {
            const currAssignment = await Assignment.findById(assignment_id);
            if (!currAssignment) throw new Error("Assignment not found");

            if (currAssignment.endTime < Date.now()) throw new Error("Assignment Has Ended");

            if (currAssignment.submissions.findIndex(sub => sub.rollNumber.toString() === submission.rollNumber.toString()) !== -1) {
                throw new Error('Already submitted');
            }

            currAssignment.submissions.push(submission);
            await currAssignment.save();
            return "Submission added successfully";
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async getAssignments(id, roll_no) {
        try {
            const currAssignment = await Assignment.findById(id);
            if (!currAssignment) throw new Error("Assignment not found");

            const sub = currAssignment.submissions;
            return { ass: currAssignment, submitted: sub.some(ele => ele.rollNumber == roll_no) };
        } catch (err) {
            throw new Error(err);
        }
    }

    async removeSub(id, roll_no) {
        try {
            const currAssignment = await Assignment.findById(id);
            if (!currAssignment) throw new Error("Assignment not found");
            if (currAssignment.endTime < Date.now()) throw new Error("Assignment Has Ended");

            currAssignment.submissions = currAssignment.submissions.filter(ele => ele.rollNumber != roll_no);
            await currAssignment.save();
            return;
        } catch (err) {
            throw new Error(err.message);
        }
    }

    async submitFeedback(feedback, roll_no, id) {
        try {
            const currAssignment = await Assignment.findById(id);
            if (!currAssignment) throw new Error("Assignment not found");

            const index = currAssignment.submissions.findIndex(submission => submission.rollNumber === roll_no);
            if (index === -1) throw new Error("Submission not found for the provided roll number");

            currAssignment.submissions[index].feedback = feedback;
            await currAssignment.save();
            return;
        } catch (err) {
            throw new Error(err);
        }
    }

    async checkSubmission(id) {
        try {
            const currAssignment = await Assignment.findById(id);
            if (!currAssignment) throw new Error("Assignment not found");
            return currAssignment;
        } catch (err) {
            throw new Error(err);
        }
    }
}

module.exports = AssigmentController;
