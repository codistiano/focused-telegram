# Focused Telegram

`Focused Telegram` is a terminal-based Telegram client focused on a small, deliberate workflow:

- choose which chats or folders you care about
- keep those chats in a clean whitelist
- read and send messages without leaving the terminal
- edit or delete your last sent message
- react to messages
- open links quickly
- download and open shared documents

This README is written as a user guide for someone using the app from scratch.

## What This App Does

This app does not try to mirror every Telegram feature.

Instead, it gives you a focused command-line interface for:

- logging into Telegram with your own account
- choosing a whitelist of chats and folders
- browsing only those whitelisted chats
- composing messages from the keyboard
- editing or deleting your most recent outgoing message in the current chat
- opening links from messages
- downloading and opening document files from messages
- keeping a saved default download directory

## Requirements

You need:

- Node.js
- npm
- a Telegram account
- a Telegram API ID and API hash

## Setup

### 1. Install dependencies

Run:

```bash
npm install
```

### 2. Create your `.env`

Create a `.env` file in the project root with:

```env
API_ID=your_telegram_api_id
API_HASH=your_telegram_api_hash
```

You get these values from Telegram's developer portal for your account/app.

### 3. Start the app

For development:

```bash
npm run dev
```

For a compiled build:

```bash
npm run build
npm start
```

## First Login

When the app starts for the first time, it connects to Telegram and asks for login details in the terminal.

You will be prompted for:

- your phone number
- the login code sent by Telegram
- your 2FA password, if your account uses one

After successful login:

- the Telegram session is saved locally
- next launches reuse that saved session
- you will not need to log in again unless you log out

Session data is stored in the local `session/` area used by the app.

## First-Time App Setup

After login, the app loads chats and folders and opens the setup screen if you do not yet have a whitelist.

The setup screen has two jobs:

- choose which chats/folders go into your whitelist
- choose the default directory where downloaded files should be saved

### Setup screen controls

- `j` / `Down Arrow`: move down
- `k` / `Up Arrow`: move up
- `Space`: select or unselect the highlighted chat/folder
- `p`: edit the default download directory
- `Enter`: save setup and continue into the main app
- `q`: quit

### Choosing whitelist items

You can whitelist:

- individual chats
- groups
- channels
- folders

If you whitelist a folder, the chats explicitly included by that folder become visible in the main screen.

### Setting the download directory

Press `p` in setup to edit the default download directory.

While editing the path:

- type normally to change the path
- `Backspace` deletes characters
- `Enter` saves the path
- `Esc` cancels path editing

The chosen directory is stored in `config.json` and reused later for document downloads.

## Main Layout

After setup, the app opens the main screen.

The screen is organized into three main areas:

### 1. Whitelisted chats pane

This is the left pane.

It shows only the chats currently available through your whitelist.

Each chat line may show:

- an active indicator for the currently opened chat
- a new-message marker if the chat has fresh activity

### 2. Messages pane

This is the main reading area.

It shows messages from the currently active chat.

The selected message is highlighted, and some message types expose extra actions:

- documents show file info
- link messages show a link action

### 3. Composer pane

This is the message entry area below the message list.

It shows:

- normal compose mode
- edit mode when editing your last outgoing message
- wrapped multi-line draft text

## Pane Navigation

The app has pane-based navigation.

The focus can be on:

- chats
- messages
- composer

### Focus controls

- `Tab`: switch between chats and messages
- `i`: move into the composer if the chat allows sending
- `Esc`: leave the composer and return to messages

## Chat Navigation

When the focus is in the chats pane:

- `j` / `Down Arrow`: move down
- `k` / `Up Arrow`: move up
- `Enter`: open the highlighted chat

Opening a chat:

- loads recent messages
- marks that chat as active
- refreshes send capability for that chat

## Message Navigation

When the focus is in the messages pane:

- `j` / `Down Arrow`: move down
- `k` / `Up Arrow`: move up

The selected message matters because several actions operate on the highlighted message.

## Writing Messages

Press `i` to enter composer mode.

While in composer mode:

- type normally to write a message
- long drafts wrap instead of truncating
- `Backspace` deletes the last character
- `Enter` sends the message
- `Esc` exits the composer without sending

### Multi-line drafting

If you type the literal text `\n`, the app converts it into a real newline inside the draft.

That means:

- typing `hello\nworld`

becomes:

```text
hello
world
```

inside the composer before sending.

## Editing Your Last Sent Message

In the main screen:

- press `e`

The app finds your most recent outgoing message in the active chat and places its contents into the composer.

While editing:

- the composer label changes to edit mode
- `Enter` saves the edit
- `Esc` cancels edit mode

Important:

- this edits your last outgoing message in the current chat
- it does not edit arbitrary old messages

## Deleting Your Last Sent Message

In the main screen:

- press `x`

The app finds your most recent outgoing message in the current chat and deletes it.

After deletion:

- the message list refreshes
- a status message confirms the deletion

## Reactions

To react to the selected message:

- move focus to the messages pane
- highlight a message
- press `r`

The quick reaction picker appears.

Then press:

- `1` for `👍`
- `2` for `❤️`
- `3` for `🔥`
- `4` for `✅`

The picker closes after input.

## Refreshing

The app already refreshes in the background, but you can also force a refresh manually.

- `Shift+R`: refresh dialogs and reload the active chat

This is useful if you want an immediate sync without waiting for the background refresh cycle.

## Adding More Chats or Folders to the Whitelist

From the main screen:

- press `a`

This opens the add-to-whitelist modal.

Only chats/folders that are not already whitelisted appear there.

### Add modal controls

- `j` / `Down Arrow`: move down
- `k` / `Up Arrow`: move up
- `Space`: select or unselect the highlighted item
- `/`: enter search mode
- `Enter`: add all selected items
- `Esc`: cancel

### Search inside the add modal

This modal supports search because the full list can be large.

To search:

- press `/`
- type your search text
- `Backspace` edits the query
- `Enter` or `Esc` exits search mode

Search filters the available add list by:

- item name
- item type
- username when available

You can still keep multiple items selected while changing the search, because the app tracks selections by item ID, not by visible row.

## Removing Chats or Folders From the Whitelist

From the chats pane:

- highlight a visible chat
- press `d`

The app behaves intelligently:

- if the selected chat was directly whitelisted, that chat is removed
- if the selected chat only appears because of a whitelisted folder, the source folder is removed from the whitelist

So you do not need a separate folder-removal command.

## Links

If a message contains a link, the app exposes link-opening support.

When a link message is selected:

- a `Link:` line appears below the panes
- in some terminals, that line is clickable directly
- `o` opens the selected link in your default browser

### Important note about clicking

True mouse-click support depends on your terminal emulator.

Some terminals support clickable OSC 8 hyperlinks.
Some do not.

So the reliable workflow is:

- move to the link message
- press `o`

## Document and File Handling

When a document-like message is selected, the app shows file information such as:

- file name
- file size
- whether it has already been downloaded

### Downloading a file

When a document message is selected:

- press `f`

The file is saved under your configured download directory.

The actual path format is:

```text
<download-directory>/<chat-name>/<message-id>-<file-name>
```

This keeps files organized by chat and avoids collisions.

### Opening a file

When a document message is selected:

- press `o`

If the file was already downloaded:

- the app opens it with the system default application

If it was not downloaded yet:

- the app downloads it first
- then opens it

### Download destination

The default download directory is chosen during setup with `p`.

That path is saved in `config.json`.

## Read-Only Chats

Some chats, groups, or channels may not allow posting.

When the active chat is read-only:

- the composer area indicates that sending is not allowed
- pressing `i` will not enter normal compose mode for sending
- the status line explains why sending is blocked

## Logout

To log out:

- press `l`

A confirmation modal appears.

Then:

- press `y` to confirm logout
- press `n` or `Esc` to cancel

Logging out:

- clears the saved Telegram session
- keeps your config file behavior intact
- exits the app

The next app start will require Telegram login again.

## Quit

To quit the app immediately:

- press `q`

This exits the program.

## Saved Local Files

The app saves local state in a few places:

- `config.json`
  Stores:
  - whitelist entries
  - default download directory

- `session/session.string`
  Stores:
  - Telegram login session

- your chosen download directory
  Stores:
  - downloaded documents grouped by chat

## Typical End-to-End Usage Example

A normal session often looks like this:

1. Start the app with `npm run dev`.
2. Log into Telegram if needed.
3. In setup, select important chats/folders.
4. Press `p` and set your download directory.
5. Press `Enter` to save setup.
6. In the main screen, use `j`/`k` to choose a chat and `Enter` to open it.
7. Use `Tab` to move into messages.
8. Press `i` to compose, type your message, then `Enter` to send.
9. If you made a mistake, press `e` to edit your last sent message.
10. If needed, press `x` to delete your last sent message.
11. If a message has a link, select it and press `o`.
12. If a message has a document, press `f` to download or `o` to open it.
13. Press `a` to add more chats/folders to the whitelist later.
14. Inside the add modal, press `/` to search and then use `j`/`k` to move.
15. Press `d` on a chat in the chat pane to remove either that chat or its source folder from the whitelist.

## Full Shortcut Reference

### Global/main workflows

- `q`: quit
- `l`: logout
- `Shift+R`: refresh chats and current messages

### Focus and panes

- `Tab`: switch chats/messages
- `i`: enter composer
- `Esc`: leave composer

### Chats pane

- `j` / `Down Arrow`: move down
- `k` / `Up Arrow`: move up
- `Enter`: open selected chat
- `d`: remove selected direct chat or its source folder from whitelist

### Messages pane

- `j` / `Down Arrow`: move down
- `k` / `Up Arrow`: move up
- `r`: react to selected message
- `o`: open selected link or selected document
- `f`: download selected document

### Composer

- type: write draft
- `\n`: insert a real newline into the draft
- `Backspace`: delete one character
- `Enter`: send or save edit
- `Esc`: exit composer

### Outgoing message actions

- `e`: edit your last outgoing message in the active chat
- `x`: delete your last outgoing message in the active chat

### Setup screen

- `j` / `Down Arrow`: move down
- `k` / `Up Arrow`: move up
- `Space`: select/unselect whitelist item
- `p`: edit download directory
- `Enter`: save setup
- `q`: quit

### Add-to-whitelist modal

- `j` / `Down Arrow`: move down
- `k` / `Up Arrow`: move up
- `Space`: select/unselect item
- `/`: enter search mode
- `Enter`: add selected items
- `Esc`: cancel

## Troubleshooting

### I cannot send in a chat

The chat may be read-only, a broadcast channel, or a place where your account lacks permission.

Check the status line and read-only message shown by the app.

### I cannot click links with the mouse

Your terminal may not support clickable terminal hyperlinks.

Use:

- move to the link message
- press `o`

### My file downloaded somewhere unexpected

Check the saved `downloadDirectory` in `config.json`.

Files are stored under:

```text
<downloadDirectory>/<chat-name>/<message-id>-<file-name>
```

### I want to change the download directory later

Right now, the main built-in place to set it is setup with `p`.

If your config already exists, you can also edit `config.json` directly.

## Developer Notes

Useful commands:

```bash
npm run dev
```

```bash
npm run build
```

```bash
./node_modules/.bin/tsc --pretty false --noEmit
```
