# React Async Component

RAC is a library used for rendering components with asynchronous data.

## Getting started

### Installation

Using `npm`

```bash
npm i react-async-comp
```

Using `yarn`

```bash
yarn add react-async-comp
```

### Quick Start Guide

```jsx
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { rac } from "react-async-comp";

const TodoList = rac(async () => {
  // fetching data
  const res = await fetch("https://jsonplaceholder.typicode.com/todos");
  const todos = await res.json();

  // rendering
  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  );
});

const App = () => {
  return (
    <>
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <Suspense fallback={<div>Loading...</div>}>
          {/* Even if the component has multiple instances, the data fetching code runs only once */}
          <TodoList />
          <TodoList />
          <TodoList />
        </Suspense>
      </ErrorBoundary>
    </>
  );
};
```

In the example above, we can use asynchronous data fetching code alongside rendering code. There are important rules to note:

- Do not use any React hooks inside the data loading function.
- All component properties must be serializable. Accepted types include: Boolean, String, null, undefined, number, RegExp, Date, PlainObject, and Array.
- RAC must be used in conjunction with the `Suspense` and `ErrorBoundary` components.

## Advanced Usages

### Using hook with RAC

To use hooks with React Async Component, the `rac(loader, render)` overload must be utilized. The `render` function accepts component props and `RenderContext` as parameters. `RenderContext` consists of the following properties:

- `revalidate`: Initiates a revalidation for only the current component.
- `revalidateAll`: Triggers a revalidation for all instances of the component.
- `data`: Represents the data fetched by the `loader()` function.

```jsx
const TodoList = rac(
  // loader function
  async () => {
    const res = await fetch("https://jsonplaceholder.typicode.com/todos");
    const todos = await res.json();

    return todos;
  },
  // render function
  (props, { data: todos, revalidate, revalidateAll }) => {
    // consume hooks or contexts
    const [state, setState] = useState();
    const store = useStore();
    // render function can accept non-serializable
    const handleClick = props.onClick;

    return (
      <ul>
        {todos.map((todo) => (
          <li onClick={handleClick} key={todo.id}>
            {todo.title}
          </li>
        ))}
      </ul>
    );
  }
);
```

### RAC data lifecycle

By default, RAC automatically disposes of fetched data if it is no longer used by any components.

```jsx
const App = () => {
  const [show, setShow] = useState(true);

  return (
    <>
      <button onClick={() => setShow(!show))>Toggle todo list</button>
      {show && <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <Suspense fallback={<div>Loading...</div>}>
          <TodoList />
        </Suspense>
      </ErrorBoundary>}
    </>
  );
};
```

When the `TodoList` is toggled, the todo list data will be disposed if TodoList is unmounted and will be refetched when `TodoList` is mounted again.

To retain the fetched data indefinitely, the following options can be utilized:

```jsx
const TodoList = rac(loader, { dispose: "never" });
```

The `dispose` option accepts two values: `never` and `unused`:

- `never`: The fetched data is never removed.
- `unused` (default): The fetched data will be removed when it is no longer used by any RAC.

### Revalidating RAC data

Revalidating RAC data involves re-executing the `loader` function and performing a re-render of all RAC instances that consume the data.

To revalidate RAC data, you can use one of the following approaches:

- Utilize the `revalidateAll` method from LoaderContext, which is the second argument of the loader function.
- Employ the `revalidate` or `revalidateAll` methods from RenderContext, provided as the second argument of the render function.
- Invoke the `revalidateAll` method directly on the RAC.

```jsx
// using revalidateAll method of LoaderContext
const TodoList = rac((props, { revalidateAll }) => {
  return (
    <>
      <button onClick={revalidateAll} />
    </>
  );
});

const TodoList = rac(
  (props) => todoList,
  // using revalidate, revalidateAll methods of RenderContext
  (props, { revalidate, revalidateAll }) => {
    return (
      <>
        <button onClick={revalidate} />
        <button onClick={revalidateAll} />
      </>
    );
  }
);

// using static revalidateAll method of RAC
TodoList.revalidateAll();
```

### Using RAC with external stores

RAC can integrate with external stores, utilizing their data and revalidating whenever the store data changes.

```jsx
import { store } from "./redux-store";

const TodoList = rac((props, { use }) => {
  // When the store state is updated, the loader function will be invoked.
  const { filter } = use(store);
  const todos = await getTodosWithFilter(filter)

  return (<>
    <ul>
      {todos.map((todo) => (
          <li key={todo.id}>
            {todo.title}
          </li>
      ))}
    </ul>
  </>);
});
```
