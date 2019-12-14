const add = require("../topic1/lesson1/task1/task1")

describe("Lesson 1 learn how to work with function", () => {
    test("given 2 and 5 returns 7", () => {
        expect(add(2, 5)).toEqual(7)
    })
})