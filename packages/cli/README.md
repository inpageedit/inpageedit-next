# InPageEdit CLI

`ipe` reads and edits MediaWiki pages using named bot profiles. It requires Node.js 22.14+ and an available system credential store (Secret Service on Linux).

## Configure a profile

Open the URL printed by this command in a browser on the same machine:

```sh
ipe login --profile docs-bot --api https://wiki.example.org/w/api.php --web
```

The page shows the target API and how to create a credential at the Wiki's `Special:BotPasswords` page. Enter the generated login name (for example, `WikiUser@ipe`) and Bot Password, then select **Verify and save profile**. You can prefill the login name with `--login-name`. Omit `--web` to use a terminal prompt with hidden password input.

Profiles are stored in `~/.inpageedit/profiles` by default. Set `IPE_CONFIG_DIR` to use a separate profile directory. Passwords are stored in the system credential store. To renew a saved credential, run `ipe login --profile docs-bot --web` again.

## Read and edit pages

```sh
ipe profile list
ipe profile use docs-bot
ipe whoami --json
ipe page search "sandbox" --json
ipe page get "Project:Sandbox" --json
ipe --profile docs-bot page edit "Project:Sandbox" --file ./page.wiki --base-revid 123 --summary "Update example" --json
ipe --profile docs-bot page create "Project:New page" --file ./new-page.wiki --summary "Create test page" --json
```

Use `--file -` to pipe page source in. Get the current `revisionId` with `page get --json` before editing. If MediaWiki returns `editconflict`, fetch the page again and reconcile the changes. Revision-based editing requires MediaWiki 1.35 or a server that exposes the `baserevid` edit parameter.

When scripting, pass `--profile` explicitly and use `--json`. Successful results go to stdout, errors go to stderr, and failures exit with a nonzero status. `login_required` includes a command to give the user. For `login --web --json`, stderr first emits a `login_url` event. Share that URL with the user and wait for the process to confirm the profile is saved. The user enters the password directly into the browser.

## Run from this repository

```sh
pnpm --filter @inpageedit/cli install --frozen-lockfile
./packages/cli/src/cli.js --help
```
