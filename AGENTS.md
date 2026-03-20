# Codex Rules for cinnabun-tracker

## 🌿 Branch Rules
- Always fetch and pull latest main before starting any task
- Always rebase on main before making changes
- Commit directly to main branch when possible
- If a branch is needed, name it: codex/short-description
- Never branch off an outdated version of main
- Do not let PRs sit open — complete and merge quickly

## 📁 File Rules
- Do not delete existing files unless explicitly instructed
- Do not rename files without asking first
- Only modify files relevant to the task
- Always make sure package.json exists before making changes
- Do not generate package-lock.json manually

## 💻 Code Style
- Follow the existing code style in the project
- Do not switch libraries or frameworks
- Do not add unnecessary dependencies to package.json
- Keep functions small and single-purpose
- Add comments for complex logic
- Always check app.js carefully to avoid overwriting existing code

## ✅ Before Finishing Any Task
- Pull latest main first
- Make sure there are no conflicts with app.js
- Make sure package.json is present and correct
- Do not leave PRs as drafts
- Mark PR as ready for review immediately

## 🔒 Security
- Never hardcode API keys, secrets, or passwords
- Always use environment variables for sensitive values
- Do not expose or modify .env files

## 📝 Commits
- Write clear and descriptive commit messages
- One commit per logical change
- Format: type: short description
  - Examples:
  - fix: correct login redirect
  - feat: add dark mode
  - docs: update readme

## 🚫 Off-limits
- Do not modify .github/workflows files
- Do not change .env or environment config files
- Do not refactor code outside the scope of the task
- Do not create draft pull requests
- Do not overwrite the entire app.js unless explicitly told to