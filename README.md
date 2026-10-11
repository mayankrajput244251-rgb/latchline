# Latchline

**A handoff desk for shared workshops.** Latchline turns Ring entrance activity into follow-ups with an owner, a simple event timeline, and a clean shift closeout.

Released under the MIT License. See [LICENSE](LICENSE).

Alexa+ is a separate project. Latchline is a fresh Ring track concept and codebase.

## Why it exists

In a shared workshop, a delivery, an unexpected visitor, or a vehicle can become someone else’s missed task during a shift change. Latchline groups entrance events into a practical queue: assign a person, mark the follow-up handled, and leave the next shift a clearer view of what happened.

## What works in this build

- Responsive operations desk with an action queue, entrance activity, and workshop handoff context.
- Demo mode with sample parcel, visitor, and vehicle events. **Run a handoff drill** adds realistic sample events so the core workflow is demoable without hardware.
- Ring Playground connection using a short-lived access token.
- Ring device discovery and 24-hour device event history, normalized into the same task queue.
- Assign-to-me and mark-handled interactions.
- Ring tokens stay in server memory, are never written to browser storage or disk, and clear on disconnect or server restart.
- No image or video capture; Latchline uses event metadata only.

## Run locally

Requires Node.js 20 or later. No package install or external service is needed for demo mode.

```sh
npm start
```

Open <http://localhost:4173>. To use another port, set `PORT` before starting the server.

## Connect the Ring Playground

1. Open [Ring Developer Playground](https://developer.amazon.com/ring) and generate a temporary access token.
2. In Latchline, choose **Connect Ring**, paste the token, and connect the workspace.
3. The app lists available devices and loads each device’s recent event history. Use **Refresh** after simulating activity in the Playground.
4. Disconnect when finished. Playground tokens expire; generate a new token to reconnect.

This lightweight hackathon build uses the Playground’s short-lived token directly. A production Ring Appstore integration needs the full OAuth account-linking, signed webhook, and partner onboarding flow.

## Demo walkthrough

1. Start in demo mode and point out the open handoff items.
2. Click **Run a handoff drill** to add another entrance event.
3. Assign the item to yourself, then mark it handled; show the queue count update.
4. Connect a Ring Playground token and show actual device history arriving in the same queue. Trigger a package, vehicle, or motion simulation and refresh.
5. Close with the privacy note: the prototype processes event metadata, not identifying or storing video.

## Project structure

```text
index.html       Operations desk and Ring connection dialog
styles.css       Responsive dark workshop interface
server.js        Static server and server-side Ring API proxy
src/app.js       Demo workflow, Ring connection, and UI rendering
src/events.js    Ring event normalization and follow-up rules
test/events.test.js  Focused event rule checks
```

## Checks

```sh
npm test
```

## Hackathon story

**Tagline:** Ring turns a workshop entrance into a shared handoff, so deliveries, visitors, and arrivals reach the person who can act on them.

**Category:** Ring

**Demo note:** Demo mode is clearly labeled and available without credentials. The Ring Playground path connects to live Ring API device and event-history endpoints.

## Current prototype limits

Tasks and assignments live in browser memory and reset on reload. Ring history is refreshed on demand; persistent storage, real-time signed webhooks, multi-user ownership, and full Ring Appstore OAuth are follow-up work. Demo mode starts with a sample arrival history so the live task flow and activity chart can be shown without credentials.
