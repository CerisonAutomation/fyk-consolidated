# Translation Management Workflow

## Overview

Translation management encompasses the tools, processes, and workflows used to create, maintain, review, and deploy translations across multiple languages. A well-designed translation workflow integrates development, translation, and deployment into a continuous pipeline.

## Core Workflow Stages

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Extract  │ -> │ Upload   │ -> │ Translate│ -> │ Review   │ -> │ Deploy   │
│ Strings  │    │ to TMS   │    │ by Human │    │ & QA     │    │ & Sync   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
     |               |               |               |               |
     v               v               v               v               v
  Source Code    Translation    Translated     Approved       Production
  Message Keys   Management     Content        Content        Messages
```

## 1. String Extraction

### Automated Extraction from Code

```bash
# React/Next.js with next-intl
npx next-intl extract

# React with react-i18next
npx i18next-scanner --config i18next-scanner.config.js

# Vue with vue-i18n
npx vue-i18n-messages src/**/*.{vue,ts,js}

# Angular
ng extract-i18n
```

### Extraction Configuration

```js
// i18next-scanner.config.js
module.exports = {
  input: ['src/**/*.{js,jsx,ts,tsx}'],
  output: './messages/',
  options: {
    sort: true,
    keySeparator: '.',
    nsSeparator: false,
    lngs: ['en', 'de', 'fr'],
    defaultLng: 'en',
    defaultValue: '',
    failOnUpdate: false,
    failOnWarnings: false,
  },
  transform: {
    file: './transform.js',
  },
};
```

### Custom Extraction Patterns

```js
// transform.js - Custom string extraction
module.exports = function (file, enc, done) {
  const content = require('fs').readFileSync(file.path, enc);
  const pattern = /t\(['"]([^'"]+)['"]/g;
  let match;

  while ((match = pattern.exec(content)) !== null) {
    this.push(match[1]);
  }
  done();
};
```

## 2. Translation Management Systems (TMS)

### Popular TMS Platforms

| Platform | Best For | Features |
|----------|----------|----------|
| Crowdin | Open source projects | Git integration, crowdsourcing, CI/CD |
| Phrase (Memsource) | Enterprise | TM, glossary, QA checks, API |
| Lokalise | Product teams | Figma integration, automation, CLI |
| Transifex | Open source | Community translation, webhooks |
| SimpleLocalize | Startups | Auto-translation, context sharing |
| Weblate | Self-hosted | Git-based, continuous translation |

### TMS Integration Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Source Code │ --> │  TMS API    │ --> │  Translators│
│  (Git)       │     │  (Upload)   │     │  (Human/MT) │
└─────────────┘     └─────────────┘     └─────────────┘
       |                   |                   |
       v                   v                   v
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  CI/CD      │ <-- │  TMS API    │ <-- │  Reviewers  │
│  (Download) │     │  (Download) │     │  (Approve)  │
└─────────────┘     └─────────────┘     └─────────────┘
```

## 3. Continuous Localization Pipeline

### GitHub Actions Example

```yaml
# .github/workflows/i18n.yml
name: Continuous Localization

on:
  push:
    branches: [main]
    paths:
      - 'messages/**'
      - 'src/**'

jobs:
  upload-translations:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Extract strings
        run: npm run i18n:extract
      
      - name: Upload to Crowdin
        uses: crowdin/github-action@v2
        with:
          upload_sources: true
          download_translations: false
        env:
          CROWDIN_PROJECT_ID: ${{ secrets.CROWDIN_PROJECT_ID }}
          CROWDIN_PERSONAL_TOKEN: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}

  download-translations:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Download translations
        uses: crowdin/github-action@v2
        with:
          upload_sources: false
          download_translations: true
        env:
          CROWDIN_PROJECT_ID: ${{ secrets.CROWDIN_PROJECT_ID }}
          CROWDIN_PERSONAL_TOKEN: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}
      
      - name: Create PR with new translations
        uses: peter-evans/create-pull-request@v5
        with:
          title: 'chore(i18n): update translations'
          branch: i18n/translations-update
```

### GitLab CI Example

```yaml
# .gitlab-ci.yml
stages:
  - extract
  - upload
  - download
  - deploy

extract-strings:
  stage: extract
  script:
    - npm run i18n:extract
  artifacts:
    paths:
      - messages/

upload-to-tms:
  stage: upload
  script:
    - npx crowdin upload --config crowdin.yml
  only:
    - main

download-translations:
  stage: download
  script:
    - npx crowdin download --config crowdin.yml
  only:
    - main
```

## 4. Message File Formats

### JSON (Most Common)

```json
{
  "navigation": {
    "home": "Home",
    "about": "About",
    "contact": "Contact Us"
  },
  "auth": {
    "login": "Sign In",
    "register": "Sign Up",
    "forgot_password": "Forgot Password?"
  }
}
```

### YAML (Human-Friendly)

```yaml
navigation:
  home: Home
  about: About
  contact: Contact Us

auth:
  login: Sign In
  register: Sign Up
  forgot_password: Forgot Password?
```

### XLIFF (Industry Standard)

```xml
<?xml version="1.0" encoding="utf-8"?>
<xliff version="1.2">
  <file source-language="en" target-language="de">
    <body>
      <trans-unit id="navigation.home">
        <source>Home</source>
        <target>Startseite</target>
      </trans-unit>
    </body>
  </file>
</xliff>
```

### PO/gettext (Classic)

```po
msgid "navigation.home"
msgstr "Startseite"

msgid "auth.login"
msgstr "Anmelden"
```

## 5. Translation Memory (TM)

### How TM Works

```
Source: "Welcome to our application"
Target: "Willkommen in unserer Anwendung"

Later, similar text appears:
Source: "Welcome to our new application"
TM suggests: "Willkommen in unserer Anwendung" (fuzzy match ~85%)
```

### TM Management Patterns

```ts
// TM leverage in translation workflow
interface TMEntry {
  source: string;
  target: string;
  locale: string;
  context?: string;
  tags?: string[];
  lastUpdated: Date;
}

// TM search with threshold
function searchTM(
  query: string,
  locale: string,
  threshold: number = 0.7
): TMEntry[] {
  return tmDatabase
    .filter(entry => entry.locale === locale)
    .filter(entry => calculateSimilarity(entry.source, query) >= threshold)
    .sort((a, b) => calculateSimilarity(b.source, query) - calculateSimilarity(a.source, query));
}
```

## 6. Glossary Management

### Glossary Structure

```json
{
  "terms": [
    {
      "source": "API",
      "target": "API",
      "locale": "de",
      "note": "Do not translate. Keep as API.",
      "forbidden": false
    },
    {
      "source": "dashboard",
      "target": "Instrumententafel",
      "locale": "de",
      "note": "The main overview page",
      "forbidden": false
    },
    {
      "source": "click",
      "target": "klicken",
      "locale": "de",
      "note": "Always use lowercase",
      "forbidden": false
    }
  ]
}
```

### Glossary Enforcement

```js
// lint rule to enforce glossary usage
module.exports = {
  rules: {
    'i18n/glossary': ['error', {
      glossary: './glossary.json',
      locales: ['de', 'fr'],
    }],
  },
};
```

## 7. Quality Assurance (QA)

### Automated QA Checks

```yaml
# Crowdin QA checklist
qa_checks:
  - missing_translations    # Keys present in source but missing in target
  - untranslated            # Target equals source (not translated)
  - punctuation             # Mismatched punctuation
  - brackets                # Mismatched brackets/parentheses
  - numbers                 # Numbers don't match source
  - spaces                  # Trailing/leading spaces
  - tags                    # HTML/JSX tags not preserved
  - length                  # Translation too long for UI
  - glossary                 # Terms not matching glossary
  - icu                     # ICU message format errors
```

### Custom QA Script

```ts
// scripts/i18n-qa.ts
import en from '../messages/en.json';

interface QAIssue {
  key: string;
  locale: string;
  issue: string;
  severity: 'error' | 'warning';
}

function runQAChecks(localeMessages: Record<string, any>, sourceMessages: Record<string, any>, locale: string): QAIssue[] {
  const issues: QAIssue[] = [];

  function check(source: Record<string, any>, target: Record<string, any>, prefix: string = '') {
    for (const [key, value] of Object.entries(source)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (!(key in target)) {
        issues.push({ key: fullKey, locale, issue: 'Missing translation', severity: 'error' });
        continue;
      }

      if (typeof value === 'object') {
        check(value, target[key], fullKey);
      } else if (value === target[key]) {
        issues.push({ key: fullKey, locale, issue: 'Untranslated (matches source)', severity: 'warning' });
      }
    }
  }

  check(sourceMessages, localeMessages);
  return issues;
}
```

## 8. Deployment Patterns

### Message Synchronization

```ts
// Deploy translations to CDN or API
async function deployTranslations(locale: string, messages: Messages) {
  // Option 1: CDN deployment
  await uploadToCDN(`i18n/${locale}/messages.json`, messages);

  // Option 2: API deployment
  await fetch(`/api/i18n/${locale}`, {
    method: 'PUT',
    body: JSON.stringify(messages),
  });

  // Option 3: Build-time embedding
  await writeToFile(`./dist/messages/${locale}.json`, messages);
}
```

### Rollback Strategy

```bash
# Tag translations in git
git tag -a v1.0.0-translations -m "Translations for v1.0.0"
git push origin v1.0.0-translations

# Rollback to previous translation version
git checkout v0.9.0-translations -- messages/
```

## 9. Context for Translators

### Providing Context

```json
{
  "_metadata": {
    "project": "MyApp",
    "version": "1.2.0",
    "lastUpdated": "2024-01-15"
  },
  "buttons": {
    "submit": {
      "text": "Submit",
      "_context": "Form submission button. Appears on all forms.",
      "_screenshot": "https://cdn.example.com/screenshots/submit-button.png"
    }
  }
}
```

### String Comments

```json
{
  "dashboard": {
    "welcome": "Welcome back, {name}!",
    "_comment_welcome": "Greeting shown on dashboard after login. {name} is the user's display name."
  }
}
```

## 10. Workflow Automation Tools

### CLI Tools

```bash
# next-intl
npx next-intl extract
npx next-intl compile

# i18next-scanner
npx i18next-scanner

# crowdin CLI
npx crowdin upload
npx crowdin download
npx crowdin status

# lokalise CLI
npx @lokalise/cli pull
npx @lokalise/cli push
```

### IDE Integration (i18n-ally)

```json
// .vscode/settings.json
{
  "i18n-ally.localesPaths": ["messages"],
  "i18n-ally.enabledFrameworks": ["next-intl"],
  "i18n-ally.keystyle": "nested",
  "i18n-ally.namespace": true,
  "i18n-ally.pathMatcher": "messages/{locale}/{namespace}.json"
}
```

## Best Practices Summary

1. **Automate extraction** - Never manually create translation keys; extract from code
2. **Use a TMS** - Even for small projects, a TMS provides TM and glossary
3. **Provide context** - Translators need screenshots, context, and usage examples
4. **Enforce QA** - Run automated checks before deploying translations
5. **Version translations** - Tag translation versions alongside code releases
6. **Use translation memory** - Leverage TM to avoid re-translating similar strings
7. **Maintain glossary** - Keep consistent terminology across the product
8. **Review in context** - Preview translations in the actual UI before merging
9. **Handle plurals properly** - Use ICU format for pluralization rules
10. **Plan for growth** - Design your namespace structure before you have 1000+ keys
