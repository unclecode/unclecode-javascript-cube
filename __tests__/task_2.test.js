const sub = require("../topic1/lesson1/task2/task2")

describe("Lesson 1 learn how to work with function", () => {
    test("given 5 and 2 returns 3", () => {
        expect(sub(5, 2)).toEqual(3)
    })
})