import { act, fireEvent, render } from "@testing-library/react";
import { rac, serializeProps } from "./rac";
import { Suspense } from "react";
import { delay } from "./utils";

const LOADING = <div>loading</div>;

describe("rac", () => {
  test("with render, stale: never", async () => {
    const values = [1, 2];

    const RAC = rac(
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
    const RAC = rac(
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

    const secondTry = render(node);

    secondTry.getByText("loading");

    await act(() => delay(10));

    secondTry.getByText("2");
  });

  test("with render and event handler", async () => {
    const values = [1, 2];
    const RAC = rac(
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

  test("serialize props", () => {
    expect(serializeProps({ node: (<div />) as any }));
  });
});
