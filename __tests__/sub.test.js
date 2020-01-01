const sub = require("../topic1/lesson1/sub/task2")

describe("Sub Function", () => {
    test("given 5 and 2 returns 3", () => {
        expect(sub(5, 2)).toEqual(3)
    });
    test("given 2 and 5 returns -3", () => {
        expect(sub(2, 5)).toEqual(-3)
    });
})

