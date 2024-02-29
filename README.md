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
      {/* Even if the component has multiple instances, the data fetching and rendering code runs only once */}
      <TodoList />
      <TodoList />
      <TodoList />
    </>
  );
};
```

In the example above, we can use asynchronous data fetching code alongside rendering code. There are important rules to note:

- Do not use any React hooks inside the React Async Component.
- All component properties must be serializable. Accepted types include: Boolean, String, null, undefined, number, RegExp, Date, PlainObject, and Array.
