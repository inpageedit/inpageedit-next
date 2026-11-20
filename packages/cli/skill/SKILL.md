---
name: ipe
description: Read, edit, and maintain MediaWiki pages with the `ipe` CLI (InPageEdit). Use when a task touches a Wiki page, file, or Action API through `ipe`, or when a Wiki account needs connecting.
---

# Working with a Wiki through `ipe`

`ipe --help` is the reference for commands and flags. This guide covers how to use them well. Add `--json` whenever you parse the output: results go to stdout, errors to stderr as `{"error":{"code",...}}`, and every failure exits nonzero.

## Profiles

A profile is one Wiki account on one Wiki: an Action API URL plus a Bot Password identity. Keep one profile per Wiki and per role (a personal account and a maintenance bot are two profiles).

- Pass `--profile NAME` on every command in a script or plan. The default profile (`ipe profile use`) belongs to the human and can change under you.
- `ipe profile list --json` shows what exists. `ipe --profile NAME whoami` confirms the account before you write anything.
- Public reads need no profile: `page search`, `page get`, `page diff`, `page preview`, and read-only `action-api` accept `--api URL` and run anonymously.

## Connecting an account

The human types the password; it reaches the CLI through their browser and never passes through you.

1. Run `ipe login --profile NAME --api URL --web --json` in the background. Prefill `--login-name User@Bot` if the human gave it.
2. Read the `{"event":"login_url","url":...}` line from stderr and send the human that URL. Tell them the page explains how to create a Bot Password at `Special:BotPasswords`, and which rights the task needs (editing, moving, uploading).
3. Wait for the process to exit. Success prints the saved profile; the page closes itself.

A `login_required` error later carries the exact command in `command`; run it the same way. If the human sends a password in chat, tell them to revoke that Bot Password and make a new one through the login page.

### Credential store prompts

On macOS the system asks before a different program reads a saved credential. A `credential_prompt` event on stderr means a dialog is waiting on the human's screen: ask them to choose **Always Allow**. After 60 seconds the command fails with `credential_store_timeout`; rerun it once they have answered.

## Editing a page

Edit a local copy with your own file-editing tools. Rewriting a whole page on the command line loses text.

1. **Fetch.** `ipe --profile P page get "Title" --out /tmp/work/Title.wiki --json`. Keep the `revisionId` from the output. For a long page, fetch only the section you need with `--section N` (0 is the lead); edits to it leave every other section untouched.
2. **Edit** the file in place.
3. **Review.** `page diff "Title" --file /tmp/work/Title.wiki --base-revid REV` must show exactly your intended change and nothing else. `page preview "Title" --file ...` lists parse warnings, categories, missing templates, and red links; fix anything your edit introduced. `--html PATH` writes the rendered page for a human to open. Show the human the diff before saving when the task did not already authorize the exact change.
4. **Save.** `page edit "Title" --file ... --base-revid REV --summary "..."`, with the same `--section N` you fetched. Write a summary a Wiki editor would understand.

`editconflict` means someone saved after your fetch. Fetch the latest revision to a second file, carry your change over, review again, and save with the new revision ID. `page create` refuses to overwrite an existing page; use the edit flow for those.

## Action API

`action-api` reaches any module the commands do not wrap: queries, patrol, protect, delete, rollback. The CLI adds `assert`, `assertuser`, and the JSON format, so set everything else yourself.

- Reads: `ipe --profile P action-api --query action=query --query list=categorymembers --query "cmtitle=Category:X"`.
- Writes: `--method POST --form key=value ... --token csrf`. Attach files with `--form file=@PATH`. For many fields, `--body PATH` (or `-` for stdin) takes a JSON object.
- Look up modules and their parameters on the Wiki itself with `action-api --query action=paraminfo`:
  - `--query modules=main` lists every `action`. `--query modules=query` lists the `list=`, `prop=`, and `meta=` submodules.
  - Name a submodule by its path: `modules=query+categorymembers`, not `categorymembers`. A wrong name only adds a `badmodule` warning and still exits 0, so check `warnings`.
  - Parameter names are listed without the module prefix: `"prefix": "cm"` with `title` means you send `cmtitle`.
  - Add `--query helpformat=wikitext` to include parameter descriptions.

## Errors

| Code                                            | Meaning and response                                                                                                                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `login_required`                                | The saved login no longer works. Have the human run the `command` from the error.                                                                                                    |
| `credential_prompt`, `credential_store_timeout` | A system dialog is waiting. See _Credential store prompts_.                                                                                                                          |
| `editconflict`                                  | The page changed since your fetch. Follow the conflict steps above.                                                                                                                  |
| `upload_warning`                                | The Wiki flagged the upload (duplicate, existing name). Show `warnings` to the human; rerun with `--ignore-warnings` only on their say-so.                                           |
| `mediawiki_error`, other MediaWiki codes        | The Wiki refused the request; the message is the Wiki's own explanation. Extensions such as moderation queues report success-with-review this way: read the message before retrying. |
| `wiki_request_failed`                           | Network or HTTP failure. Check the API URL and connectivity, then retry once.                                                                                                        |

## Working at scale

Before any change that touches more than one page, list the targets and show the human the list plus one representative diff. Save pages one at a time, stop at the first unexpected error, and report which pages were done.
