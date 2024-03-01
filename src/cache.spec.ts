import { getKey } from "./cache";

describe("cache", () => {
  test("nested props", () => {
    const actual = getKey({
      l1: { l2: { l3: 1, l4: 2, l5: 3 }, l6: 2, l7: {} },
    });
    const expected = `{"l1":{"l2":{"l3":1,"l4":2,"l5":3},"l6":2}}`;
    expect(expected).toBe(actual);
  });
});
