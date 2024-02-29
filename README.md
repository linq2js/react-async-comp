# React Async Component

React Async Component (RAC) is a library used for rendering components with asynchronous data.

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
          {/* Even if the component has multiple instances, the data fetching and rendering code runs only once */}
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

- Do not use any React hooks inside the React Async Component.
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

### RAC lifecycle

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
