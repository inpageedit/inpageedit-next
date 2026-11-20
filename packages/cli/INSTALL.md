# Installing the InPageEdit CLI

You are setting up `ipe`, a CLI that lets you read and edit MediaWiki pages on behalf of the human you are working with. Follow these steps in order. The human only needs to do two things: answer which Wiki to connect, and fill in a login page in their browser.

## 1. Check the environment

- Node.js 22.14 or newer: `node -v`. If it is missing or older, ask the human to install or upgrade Node.js before continuing.
- A system credential store. macOS and Windows always have one. On Linux, a Secret Service provider (such as GNOME Keyring) must be running and unlocked; without it, saving a login fails with `credential_store_error`.

## 2. Install

Install globally unless the human prefers otherwise:

```sh
npm i -g @inpageedit/cli
ipe --version
```

If the human does not want a global install, run every command through `npx -y @inpageedit/cli` instead of `ipe`. This applies to every command in this guide, in `ipe skill`, and in the `command` field of errors.

## 3. Connect a Wiki account

Ask the human for:

- **The Wiki's Action API URL.** It is listed on the Wiki's `Special:Version` page under _Entry point URLs_ (usually ending in `/api.php`).
- **A profile name.** Suggest one from the Wiki's name, such as `mywiki`. Use a separate profile per Wiki and per account.

Then start the login in the background:

```sh
ipe login --profile NAME --api URL --web --json
```

1. Read the `{"event":"login_url","url":"..."}` line from stderr and send that URL to the human.
2. Tell them the page explains how to create a Bot Password at the Wiki's `Special:BotPasswords`, and which rights to grant for what they want you to do (editing, moving pages, uploading files).
3. Wait for the process to exit. Exit code 0 means the profile is saved. The link expires after 10 minutes; if the human misses it, start the login again.
4. Confirm the account: `ipe --profile NAME whoami`.

Never ask the human to type the password into the chat. If they do, tell them to revoke that Bot Password and create a new one through the login page.

## 4. Learn the workflow

Run `ipe skill`. It prints the usage guide for the installed version: profiles, the fetch, edit, review, save workflow, the Action API, and error codes. Read it before you touch any page.

Offer to save it as a skill so future sessions load it automatically, for example:

```sh
mkdir -p ~/.claude/skills/ipe && ipe skill > ~/.claude/skills/ipe/SKILL.md
```

Use the skills directory your own agent loads from. Ask the human before writing into their agent configuration.

## Troubleshooting

| Symptom                                                    | Cause and fix                                                                                                                                                                                                              |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wiki_request_failed`, `NETWORK_ERROR`, or `TIMEOUT`       | The CLI honours `http_proxy`, `https_proxy`, and `no_proxy`. Check that the Wiki is reachable with the same variables (for example with `curl`), and that `no_proxy` does not exclude a Wiki that must go through a proxy. |
| `credential_prompt` event, then `credential_store_timeout` | macOS is showing a Keychain dialog, usually after Node.js was reinstalled or switched. Ask the human to choose **Always Allow**, then rerun the command.                                                                   |
| `credential_store_error`                                   | No usable credential store. On Linux, start and unlock a Secret Service provider.                                                                                                                                          |
| `login_required`                                           | The saved Bot Password no longer works. Run the `command` from the error the same way as step 3.                                                                                                                           |
| Edits fail on an old Wiki                                  | Revision-checked editing needs MediaWiki 1.35 or newer.                                                                                                                                                                    |

Profiles live in `~/.config/inpageedit/profiles`. Set `IPE_CONFIG_DIR` to use another directory. Passwords and session cookies are kept only in the system credential store.
