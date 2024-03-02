import { act, fireEvent, render } from "@testing-library/react";
import { view } from "./view";
import {
  ForwardedRef,
  PropsWithChildren,
  StrictMode,
  Suspense,
  useRef,
  useState,
} from "react";
import { delay } from "./utils";
import { clearAllEffects, revalidate, tag } from "./effect";
import { clearAllCache } from "./cache";
import { AnyFunc } from "./types";

const LOADING = <div>loading</div>;

beforeEach(() => {
  clearAllEffects();
  clearAllCache();
});

describe("view", () => {
  test("with render, stale: never", async () => {
    const values = [1, 2];

    const RAC = view(
      async () => ({ value: values.shift() }),
      (_, { data }) => {
        return <div>{data.value}</div>;
      }
    );
    const node = (
      <Suspense fallback={LOADING}>
        <RAC />
      </Suspense>
    );
    const { getByText, rerender } = render(node);

    getByText("loading");

    await act(() => delay(10));

    getByText("1");

    rerender(node);

    getByText("1");
  });

  test("with render, stale: unused", async () => {
    const values = [1, 2];
    const RAC = view(
      async () => ({ value: values.shift() }),
      (_, { data }) => {
        return <div>{data.value}</div>;
      },
      { dispose: "unused" }
    );
    const node = (
      <Suspense fallback={LOADING}>
        <RAC />
      </Suspense>
    );
    const { getByText, rerender, unmount } = render(node);

    getByText("loading");

    await act(() => delay(10));

    getByText("1");

    rerender(node);

    getByText("1");

    unmount();

    await delay();

    const secondTry = render(node);

    secondTry.getByText("loading");

    await act(() => delay(10));

    secondTry.getByText("2");
  });

  test("with render and event handler", async () => {
    const values = [1, 2];
    const RAC = view(
      async () => ({ value: values.shift() }),
      (props: { onClick: VoidFunction }, { data }) => {
        return <div onClick={props.onClick}>{data.value}</div>;
      }
    );
    const log = jest.fn();
    const { getByText } = render(
      <Suspense fallback={LOADING}>
        <RAC onClick={log} />
      </Suspense>
    );

    getByText("loading");

    await act(() => delay(10));

    fireEvent.click(getByText("1"));
    fireEvent.click(getByText("1"));

    expect(log).toHaveBeenCalledTimes(2);
  });

  test("tag", () => {
    const values = [1, 2, 3, 4, 5, 6];
    const R1 = view((_, { use }) => {
      use(tag(["r1", "r"]));

      return <div>r1:{values.shift()}</div>;
    });

    const R2 = view((_, { use }) => {
      use(tag(["r2", "r"]));

      return <div>r2:{values.shift()}</div>;
    });

    const { getByText } = render(
      <>
        <R1 />
        <R2 />
      </>
    );

    getByText("r1:1");
    getByText("r2:2");

    act(() => {
      revalidate("r1");
    });
    getByText("r1:3");
    act(() => {
      revalidate("r2");
    });
    getByText("r2:4");

    act(() => {
      revalidate("r");
    });
    getByText("r1:5");
    getByText("r2:6");
  });

  test("update cache", () => {
    const R1 = view(
      () => 1,
      (_props, { data }) => <div>{data}</div>
    );
    const { getByText } = render(
      <StrictMode>
        <R1 />
      </StrictMode>
    );

    getByText("1");

    act(() => {
      R1.set((prev) => prev + 1);
    });

    getByText("2");
  });

  test("memoize callbacks", () => {
    const childRender = jest.fn();
    const parentRender = jest.fn();
    let persistCallback: AnyFunc | undefined;
    const RAC = view(
      () => 1,
      (
        props: PropsWithChildren<{
          ref: ForwardedRef<HTMLButtonElement>;
          callback?: VoidFunction;
        }>
      ) => {
        childRender("render");
        expect(props.ref).not.toBeUndefined();
        persistCallback = props.callback;
        return <></>;
      }
    );

    const App = () => {
      const buttonRef = useRef<HTMLButtonElement>(null);
      const [count, setCount] = useState(1);
      const callback = () => {
        return count;
      };
      parentRender();

      return (
        <>
          <button onClick={() => setCount(count + 1)}>click</button>
          <RAC callback={callback} ref={buttonRef} />
        </>
      );
    };

    const { rerender, getByText } = render(<App />);

    rerender(<App />);
    rerender(<App />);
    rerender(<App />);

    expect(childRender).toHaveBeenCalledTimes(1);
    expect(parentRender).toHaveBeenCalledTimes(4);
    expect(persistCallback?.()).toBe(1);
    fireEvent.click(getByText("click"));
    expect(persistCallback?.()).toBe(2);
  });
});
