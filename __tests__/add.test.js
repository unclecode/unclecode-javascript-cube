const add = require("../topic1/lesson1/add/task1")

describe("Add Function", () => {
    test("given 2 and 5 returns 7", () => {
        expect(add(2, 5)).toEqual(7)
    });
    test("given 0 and 5 returns 5", () => {
        expect(add(0, 5)).toEqual(5)
    });
    test("given -3 and 5 returns 2", () => {
        expect(add(-3, 5)).toEqual(2)
    });
})
