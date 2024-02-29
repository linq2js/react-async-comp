# Contributing

## Reporting Issues

If you have found what you think is a bug,
and for usage questions,
please [start a discussion].

## Suggesting new features

If you are here to suggest a feature,
first [start a discussion] if it does not already exist.
From there, we will discuss use-cases for the feature,
and then finally discuss how it could be implemented.

[start a discussion]: https://github.com/linq2js/ezmodel/discussions/new

## Development

If you would like to contribute by fixing an open issue
or developing a new feature,
you can use this suggested workflow:

- Fork this repository;
- Create a new feature branch based on the `main` branch;
- Install dependencies by running `yarn`
  ([version 1](https://classic.yarnpkg.com/lang/en/docs/install));
- Create failing tests for your fix or new feature;
- Implement your changes and confirm that all test are passing.
  You can run the tests continuously during development
  with the `yarn test` command.
- If you want to test it in a React project:
  - Either use `yarn link`, or
  - Use the `yalc` package.
- Commit your changes (see the [committing guidelines]).
- Submit a PR for review.

[committing guidelines]: #committing

### Committing

We are applying [conventional commits] here.
In short, that means a commit has to be one of the following types:

- **feat**: A new feature.
- **fix**: A bug fix.
- **docs**: Documentation-only changes.
- **refactor**: A code change that neither fixes a bug nor adds a feature.
- **test**: Adding missing or correcting existing tests.
- **chore**: Changes to the build process or auxiliary tools and libraries,
  such as documentation generation

If you are unfamiliar with the usage of conventional commits,
the short version is to simply specify the type as a first word,
and follow it with a colon and a space, then start your message
from a lowercase letter, like this:

```
feat: add a 'ezmodel' storage type support
```

You can also specify the scope of the commit in the parentheses after a type:

```
fix(middleware): change the bear parameter in devtools
```

[conventional commits]: https://www.conventionalcommits.org/en/v1.0.0/

## Pull requests

Please try to keep your pull requests focused and small in scope,
and avoid including unrelated commits.

After you have submitted your pull request,
we'll try to get back to you as soon as possible.
We may suggest some changes or improvements.

Thank you for contributing! :heart:
