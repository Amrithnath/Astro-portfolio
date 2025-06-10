# 🚀 Astro Portfolio

![Deploy Status](https://img.shields.io/github/actions/workflow/status/Amrithnath/Astro-portfolio/deploy.yml?branch=main&label=deploy)
![Tests](https://img.shields.io/github/actions/workflow/status/Amrithnath/Astro-portfolio/lint.yml?branch=main&label=tests)
![Comprehensive Tests](https://img.shields.io/github/actions/workflow/status/Amrithnath/Astro-portfolio/test.yml?branch=main&label=quality)
![GitHub](https://img.shields.io/github/license/Amrithnath/Astro-portfolio)
![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![Package Manager](https://img.shields.io/badge/package%20manager-pnpm-orange)

A modern, responsive portfolio website built with [Astro](https://astro.build/). This portfolio showcases projects, skills, and experience with excellent performance and SEO optimization.

## ✨ Features

- ⚡ **Lightning Fast**: Built with Astro for optimal performance
- 📱 **Responsive Design**: Looks great on all devices
- 🎨 **Modern UI**: Clean and professional design
- 🔍 **SEO Optimized**: Built-in SEO best practices
- 🚀 **Easy Deployment**: Multiple deployment options (GitHub Pages, GCP)
- 🔧 **Type Safe**: Full TypeScript support
- 🧪 **Comprehensive Testing**: Automated quality assurance
- ♿ **Accessibility**: WCAG compliance testing

## 🛠️ Tech Stack

- **Framework**: [Astro](https://astro.build/)
- **Language**: TypeScript
- **Styling**: CSS with LightningCSS
- **Font**: Fira Code
- **Code Quality**: Prettier + TypeScript
- **Deployment**: GitHub Pages / Google Cloud Storage
- **CI/CD**: GitHub Actions

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm (recommended package manager)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Amrithnath/Astro-portfolio.git
   cd Astro-portfolio
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Start the development server:
   ```bash
   pnpm dev
   ```

4. Open [http://localhost:4321](http://localhost:4321) in your browser

## 📚 Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm preview` | Preview production build locally |
| `pnpm check` | Run TypeScript and Astro checks |
| `pnpm test` | Run all tests (type check + build) |
| `pnpm lint` | Run linting checks |
| `pnpm format` | Format code with Prettier |
| `pnpm format:check` | Check code formatting |
| `pnpm clean` | Clean build artifacts |
| `pnpm audit` | Run security audit |

## 📁 Project Structure

```
├── src/
│   ├── components/     # Reusable components
│   ├── layouts/        # Page layouts
│   ├── pages/          # Page routes
│   ├── styles/         # Global styles
│   ├── data/           # Static data
│   └── assets/         # Static assets
├── public/             # Public assets
├── .github/workflows/  # CI/CD workflows
└── dist/               # Built site (generated)
```

## 🧪 Testing & Quality Assurance

This project includes comprehensive testing and quality checks:

### Automated Tests
- **Type Safety**: TypeScript compilation checks
- **Build Validation**: Ensures successful builds
- **Code Formatting**: Prettier formatting validation
- **Security Audits**: Dependency vulnerability scanning
- **Accessibility**: axe-core accessibility testing
- **Performance**: Bundle size analysis
- **Link Validation**: Broken link detection

### CI/CD Workflows
- **Lint and Test**: Basic quality checks on every push/PR
- **Comprehensive Tests**: Full test suite including accessibility and performance
- **Deploy**: Automated deployment after successful tests
- **Badge Updates**: Status badge maintenance

## 🚢 Deployment

This project supports multiple deployment options:

### GitHub Pages (Default)
Automatically deploys to GitHub Pages on push to `main` branch after all tests pass.

### Google Cloud Storage
Configure the following repository secrets and variables:
- `GCP_WORKFLOW_ID_PROVIDER_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` 
- `GCLOUD_BUCKET`

### Manual Deployment
You can manually trigger deployments using the GitHub Actions interface.

## 🔧 Customization

1. **Personal Information**: Update content in `src/data/`
2. **Styling**: Modify styles in `src/styles/`
3. **Components**: Add/edit components in `src/components/`
4. **Pages**: Create new pages in `src/pages/`

## 🏗️ Development Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Run tests locally: `pnpm test`
4. Format code: `pnpm format`
5. Commit and push your changes
6. Create a Pull Request
7. Automated tests will run
8. Merge after approval and passing tests

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Contact

- Portfolio: [Your Live Site URL]
- Email: [Your Email]
- LinkedIn: [Your LinkedIn]
- GitHub: [@Amrithnath](https://github.com/Amrithnath)

---

⭐ Star this repository if you found it helpful!

[Edit on StackBlitz ⚡️](https://stackblitz.com/edit/github-tfldar)


<!-- add the line for the badges from the linter -->



