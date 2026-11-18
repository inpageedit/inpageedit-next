# InPageEdit CLI

`ipe` reads and edits MediaWiki pages using named bot profiles. It requires Node.js 22.14+ and an available system credential store.

## Configure a profile

Open the URL printed by this command in a browser on the same machine:

```sh
ipe login --profile docs-bot --api https://wiki.example.org/w/api.php --web
```

The page shows the target API and how to create a credential at the Wiki's `Special:BotPasswords` page. Enter the generated login name (for example, `WikiUser@ipe`) and Bot Password, then select **Verify and save profile**. You can prefill the login name with `--login-name`. Omit `--web` to use a terminal prompt with hidden password input.

Profiles are stored in `~/.config/inpageedit/profiles` by default. Set `IPE_CONFIG_DIR` to use a separate configuration directory. To renew a saved credential, run `ipe login --profile docs-bot --web` again.

Bot Passwords are stored in macOS Keychain, Windows Credential Manager, or Linux Secret Service (for example, GNOME Keyring). Linux needs a running, accessible Secret Service provider. Systems without an available credential store return `credential_store_error`.

macOS asks before a different program reads a saved credential, for example after switching Node.js installations. While that prompt is open, the CLI writes a notice to stderr (a `credential_prompt` event with `--json`) and gives up with `credential_store_timeout` after 60 seconds.

Verified session cookies are also stored in the system credential store, scoped to the profile. Subsequent commands reuse them and MediaWiki checks the expected username on every operation. When the session expires, the CLI attempts to log in once with the saved Bot Password. It returns `login_required` if the user needs to renew that password.

## Read and edit pages

```sh
ipe profile list
ipe profile use docs-bot
ipe whoami --json
ipe page search "sandbox" --json
ipe page get "Project:Sandbox" --section 2 --out ./sandbox.wiki --json
ipe --profile docs-bot page diff "Project:Sandbox" --file ./sandbox.wiki --section 2 --base-revid 123
ipe --profile docs-bot page preview "Project:Sandbox" --file ./sandbox.wiki --html ./preview.html
ipe --profile docs-bot page edit "Project:Sandbox" --file ./sandbox.wiki --section 2 --base-revid 123 --summary "Update example" --json
ipe --profile docs-bot page create "Project:New page" --file ./new-page.wiki --summary "Create test page" --json
```

`--section N` reads or replaces one section (0 is the lead). `page diff` compares a local file with the latest revision, or with `--base-revid`. `page preview` parses a local file as the Wiki would on save and lists parse warnings, categories, missing templates, and red links. Edits require the `revisionId` they are based on and fail with `editconflict` when the page has changed since. Revision-based editing requires MediaWiki 1.35 or a server that exposes the `baserevid` edit parameter.

## Use with an agent

`ipe skill` prints a guide for agents: profiles, asking the user to log in through the web page, the fetch–edit–review–save workflow, the Action API, and error codes. It ships with each release, so it always matches the installed CLI. Point your agent at it, or save it as a skill:

```sh
ipe skill > ~/.agents/skills/ipe/SKILL.md
```

## Read anonymously

`page get`, `page search`, and `action-api` without `--token` accept `--api URL` in place of a profile. They send no credentials, so the Wiki applies its anonymous permissions.

```sh
ipe page get "Project:Sandbox" --api https://wiki.example.org/w/api.php --json
```

## Move pages and upload files

```sh
ipe page move "Project:Old title" "Project:New title" --reason "Correct title" --move-talk
ipe file upload ./diagram.png --filename Diagram.png --summary "Upload a diagram" --description-file ./description.wiki --json
```

A move leaves a redirect by default. Use `--no-redirect` to suppress it and `--move-talk` to request moving the talk page too. The result includes the actual destination and any reported talk-page warning.

Uploads use the local basename by default and support a wikitext description from a file or stdin (`--description-file -`). MediaWiki warnings such as an existing filename return `upload_warning` with warning details and, when available, a stashed file key. Review the warnings before re-running with `--ignore-warnings`, which can allow an existing file to be replaced.

## Send a direct Action API request

```sh
ipe action-api --query action=query --query list=categorymembers --query 'cmtitle=Category:Examples'
ipe action-api --method POST --query action=query --form 'titles=Project:Sandbox' --form prop=info
ipe action-api --method POST --query action=upload --form filename=Diagram.png --form file=@./diagram.png --token csrf
```

Use `--query KEY=VALUE` repeatedly for URL parameters and `--form KEY=VALUE` for POST fields. In a form, `KEY=@PATH` attaches a local file. Alternatively, `--body PATH` loads parameters from a JSON object in a file or from stdin with `--body -`. JSON values can be strings, numbers, booleans, or null. `true` becomes `1`, and `false` and null are omitted. The CLI sends these as form fields.

The command uses the selected profile endpoint and its authenticated session. The CLI supplies `assert`, `assertuser`, and the JSON output format. With `--token csrf`, it obtains and adds the CSRF token. Successful requests print the MediaWiki response as JSON.

## Run from this repository

```sh
pnpm --filter @inpageedit/cli install --frozen-lockfile
pnpm --filter @inpageedit/cli build
node packages/cli/dist/cli.js --help
```

`pnpm --filter @inpageedit/cli dev -- <args>` runs the TypeScript source directly.
