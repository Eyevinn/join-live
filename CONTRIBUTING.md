# Contributing to Join Live

We love your input! We want to make contributing to Join Live as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## We Develop with GitHub

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

## We Use [GitHub Flow](https://guides.github.com/introduction/flow/index.html)

Pull requests are the best way to propose changes to the codebase. We actively welcome your pull requests:

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

## Any contributions you make will be under the Apache 2.0 Software License

In short, when you submit code changes, your submissions are understood to be under the same [Apache 2.0 License](http://choosealicense.com/licenses/apache-2.0/) that covers the project. Feel free to contact the maintainers if that's a concern.

## Report bugs using GitHub's [issue tracker](https://github.com/Eyevinn/join-live/issues)

We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/Eyevinn/join-live/issues/new); it's that easy!

## Write bug reports with detail, background, and sample code

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

People *love* thorough bug reports. I'm not even kidding.

## Development Environment

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Docker (optional, for containerized development)

### Setting up the development environment

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Eyevinn/join-live.git
   cd join-live
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm start
   ```

4. **Access the application:**
   - Participant view: http://localhost:3000/join
   - Editor view: http://localhost:3000/editor
   - OBS Browser Source: http://localhost:3000/source

### Using Docker for development

```bash
# Build and run with Docker Compose
docker-compose up --build

# Or use npm scripts
npm run docker:compose-build
```

## Code Style

We use standard JavaScript conventions:

- Use semicolons
- 2 spaces for indentation
- Prefer `const` and `let` over `var`
- Use meaningful variable and function names
- Add comments for complex logic

### Copyright Headers

All source files must include the Apache 2.0 copyright header:

```javascript
/**
 * Copyright 2025 Eyevinn Technology AB
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
```

## Testing

We encourage adding tests for new features and bug fixes. The project uses:

- Manual testing for UI components
- Integration testing for WebRTC functionality
- Docker testing for deployment scenarios

## Feature Requests

We're always looking for suggestions to make Join Live better. Feature requests are tracked as GitHub issues.

When submitting a feature request:

1. **Check existing issues** to avoid duplicates
2. **Provide a clear title** and description
3. **Explain the motivation** - what problem does this solve?
4. **Describe the solution** you'd like to see
5. **Consider alternatives** you've thought about

## Community

- Join our discussions in GitHub Issues
- Follow [@EyevinnTech](https://twitter.com/EyevinnTech) on Twitter
- Check out our other open source projects at [Eyevinn Technology](https://github.com/Eyevinn)

## Questions?

Don't hesitate to ask questions in GitHub Issues or reach out to the maintainers.

## License

By contributing, you agree that your contributions will be licensed under the Apache 2.0 License.