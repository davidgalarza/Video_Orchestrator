# Contributing to Veo Generative Video Orchestrator

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/Vid_Gen.git`
3. Install dependencies: `npm install`
4. Create a new branch: `git checkout -b feature/your-feature-name`

## Development Workflow

### Running the Development Server

```bash
npm run dev
```

### Building for Production

```bash
npm run build
```

### Code Style

- **TypeScript:** Use strict typing where possible
- **Components:** Use functional components with hooks
- **Styling:** Use Tailwind CSS utility classes
- **Imports:** Group imports by external, internal, then relative

### Before Submitting

- [ ] Run the app locally and test your changes
- [ ] Check for TypeScript errors: `npx tsc --noEmit`
- [ ] Ensure your code follows the existing style
- [ ] Add/update documentation if needed

## Project Structure

```
├── src/
│   ├── api.ts              # Data layer (IndexedDB + localStorage)
│   ├── db.ts               # IndexedDB schema
│   ├── ai.ts               # Google GenAI integration
│   ├── ffmpeg.ts           # Video processing
│   ├── store/
│   │   └── settings.ts     # localStorage management
│   ├── components/         # React components
│   ├── pages/              # Page components
│   └── App.tsx            # Main app component
├── public/                 # Static assets
├── index.html             # Entry HTML
├── package.json           # Dependencies
├── MIGRATION.md           # Migration guide (from old backend)
├── README.md              # Project documentation
├── LICENSE                # MIT License
└── CONTRIBUTING.md        # This file
```

## Types of Contributions

### Bug Reports

When reporting bugs, please include:
- Browser and version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Console error messages

### Feature Requests

We welcome feature ideas! Please:
- Check if the feature already exists
- Describe the use case
- Explain why it would be valuable

### Code Contributions

#### Adding a New Feature

1. Open an issue to discuss the feature first
2. Get approval from maintainers
3. Implement the feature
4. Add tests if applicable
5. Update documentation

#### Fixing a Bug

1. Reference the issue number in your PR
2. Describe the root cause
3. Explain your solution

### Documentation

Documentation improvements are always welcome:
- README updates
- Code comments
- JSDoc annotations
- Usage examples

## Commit Messages

Use clear, descriptive commit messages:

```
feat: Add video export to MP4 format
fix: Resolve IndexedDB connection error
docs: Update API key setup instructions
style: Format component files
refactor: Extract video generation hook
test: Add unit tests for db operations
```

## Pull Request Process

1. Update your fork to the latest main branch
2. Push your changes to your fork
3. Open a Pull Request against the main repository
4. Fill out the PR template completely
5. Link any related issues
6. Wait for review and address feedback

### PR Checklist

- [ ] Branch is up to date with main
- [ ] Code compiles without errors
- [ ] No console warnings introduced
- [ ] Feature works as expected
- [ ] Documentation updated
- [ ] Commit messages are clear

## Code Review

All submissions require review. We aim to respond within:
- Bug fixes: 2-3 days
- Features: 5-7 days
- Documentation: 1-2 days

## Community

- Be respectful and constructive
- Help others learn and grow
- Share knowledge and ideas
- Follow the Code of Conduct

## Questions?

If you have questions:
- Open a Discussion for general questions
- Open an Issue for bugs or feature requests
- Comment on existing issues/PRs

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for helping make this project better!
