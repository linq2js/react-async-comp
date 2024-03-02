import { cache } from "./cache";
import { Loader, LoaderContext } from "./types";

describe("cache", () => {
  test("cache dependency", async () => {
    const count = () => 3;
    const doubledCount: Loader<number> = async (_, { use }: LoaderContext) => {
      return (await use(cache(count))) * 2;
    };
    expect(await cache(doubledCount).load()).toBe(6);
    cache(count).set(2);
    expect(await cache(doubledCount).load()).toBe(4);
  });
});
