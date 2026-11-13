# Linework

An open-source, diagram-as-code canvas for system design. Write a few lines of text, get a clean auto-laid-out architecture diagram.

```
title URL Shortener

User [icon: user, color: blue]

App Tier [icon: server, color: green] {
  API [icon: api]
  Worker [icon: worker]
}

DB [icon: postgres, color: orange]
Queue [icon: kafka]

User > API: HTTPS
API > DB: read/write
API --> Queue: events
Queue > Worker
```

## Features

- **Diagram as code** with live preview, syntax highlighting and inline errors
- **Three kinds of diagram**: architecture/flow diagrams, sequence diagrams and ER (database) diagrams
- **Automatic layout** (ELK layered, orthogonal routing) with nested groups
- **Official cloud icons**: ~300 AWS, ~600 Azure and ~200 Google Cloud architecture icons (`aws-lambda`, `azure-cosmos-db`, `gcp-bigquery`...)
- **2,000+ tech logos** for databases and tools (`postgres`, `mongodb`, `redis`, `kafka`, `kubernetes`, `stripe`...)
- **1,500+ generic icons** (Lucide) with system-design aliases (`db`, `cache`, `queue`, `load-balancer`, `worker`...)
- Icons load on demand, so a diagram only downloads the icons it uses
- **Shapes**: rect, oval, diamond, cylinder; named colors or any hex
- **Click a node** on the canvas to jump to its line in the editor
- **Pan & zoom** (drag, scroll, pinch / ⌘+scroll, ⇧1 to fit)
- **Export** PNG, SVG, or copy the image to the clipboard
- **Share links**: the whole diagram is compressed into the URL hash, no server needed
- Light and dark themes; diagrams autosave to `.lw` files in `diagrams/`

## Getting started

Install the command line tool:

```bash
npm install -g linework-mcp
```

That gives you a `linework` command (or skip the install and use `npx linework-mcp` in its place):

```bash
linework new checkout --kind sequence     # start diagrams/checkout.lw (flow, sequence or er)
linework                                  # open the app on ./diagrams in your browser
linework render checkout                  # save diagrams/checkout.png
linework render -o docs/images -t dark    # every diagram, dark theme, into docs/images
linework render arch.lw -o arch.svg -w    # SVG, re-rendered whenever the file changes
linework check                            # report mistakes in every diagram; exits 1 on errors (handy in CI)
```

A diagram argument can be a file, a folder, or a name in the diagrams folder (`checkout` means `diagrams/checkout.lw`). Run `linework --help` for every option.

To let an AI agent draw, see the MCP server below. To work on Linework itself, from a checkout:

```bash
npm install
npm run dev
```

Working on Linework itself: the repo's `.mcp.json` registers the MCP server from source (`tsx mcp/cli.ts --no-app`), and `npm run dev` serves the app with live reload on the same `diagrams/` folder.

Other scripts: `npm test`, `npm run build` (app in `dist/app`, CLI in `dist/node`), `npm run typecheck`, `npm run mcp` (MCP server from source), `npm run linework -- <command>` (the CLI from source).

Releasing: from `main`, run `npm version patch && git push --follow-tags`. The Release workflow builds, tests and **stages** the version on npm using [trusted publishing](https://docs.npmjs.com/trusted-publishers) (no stored token; provenance included). A maintainer then makes it public with 2FA: `npm stage list linework-mcp`, then `npm stage approve <stage-id>` (or approve on npmjs.com). Versions already on npm are skipped; to retry an existing tag, run the Release workflow by hand from the Actions tab.

## Let an AI agent draw: the MCP server

Linework ships as an [MCP](https://modelcontextprotocol.io) server on npm, [`linework-mcp`](https://www.npmjs.com/package/linework-mcp), so Claude (or any MCP client) can create and edit diagrams while you watch them draw.

**Claude Code**, from the project you want diagrams in:

```bash
claude mcp add linework -- npx -y linework-mcp
```

Then ask for a design, e.g. *"Draw the backend for a ride-sharing app on AWS, then a sequence diagram of booking a ride."* The server also serves the Linework app at **http://localhost:5173** (or the next free port): open it to watch diagrams appear and to edit them yourself. Every tool result includes a link.

Diagrams are plain `.lw` files in `./diagrams`, so they can be committed and reviewed like code. Edits from the app, the agent or your text editor all show up live.

**Other MCP clients** (e.g. Claude Desktop) run the same command; give it a diagrams folder, since desktop apps don't start in your project:

```json
{
  "mcpServers": {
    "linework": {
      "command": "npx",
      "args": ["-y", "linework-mcp", "--dir", "/path/to/your/diagrams"]
    }
  }
}
```

Options: `--dir <path>` (diagrams folder), `--port <n>` (app port, default 5173), `--no-app` (MCP only). Started from a terminal rather than by an MCP client, the same command opens the app instead (`linework mcp` forces the server).

| Tool | What it does |
| --- | --- |
| `get_syntax_guide` | The diagram language, with tips for clear system designs |
| `list_diagrams` | Diagrams in the workspace, newest first |
| `read_diagram` | Source, current version and any problems |
| `write_diagram` | Create a diagram, or replace one (needs the version from `read_diagram`, so your edits are never overwritten) |
| `edit_diagram` | Replace an exact piece of text |
| `search_icons` | Find exact icon names: "dynamo" → `aws-dynamodb`, "cosmos" → `azure-cosmos-db` |
| `render_diagram` | Render a PNG exactly as the app draws it, plus a count of crossing connections, so the agent can look at the layout and improve it |
| `export_diagram` | Save a diagram as a PNG (2x) or SVG file, next to the diagram or at a path in your project (e.g. `docs/architecture.png`) |

Every write returns syntax errors, unknown icons (with close matches) and components that were never declared, so the agent can fix its own mistakes. With `render_diagram` it can also see the result: rendering runs on the server with the same layout and renderer as the app (resvg, with the bundled Geist fonts), so no browser is needed.

## Language reference

| Syntax | Meaning |
| --- | --- |
| `Name [icon: server, color: blue]` | Node with attributes (`icon`, `color`, `shape`, `label`) |
| `Group [icon: cloud] { ... }` | Group; nest nodes and other groups inside |
| `A > B` / `A < B` / `A <> B` / `A - B` | Arrow / reverse / both ways / plain line |
| `A --> B` / `A <-- B` / `A <--> B` / `A -- B` | Dashed variants |
| `A > B: label` | Connection label |
| `A > B, C` and `A > B > C` | Fan-out and chains |
| `A > B [color: red]` | Colored connection |
| `direction down` | `right` (default), `down`, `left`, `up` |
| `title My diagram` | Title drawn above the diagram |
| `// comment` | Comment (⌘/ toggles in the editor) |

### Sequence diagrams

Start the file with `diagram sequence`:

```
diagram sequence
title Checkout
autonumber

Shopper [icon: user]
API [icon: aws-api-gateway]
Payments [icon: stripe]

Shopper > API: POST /orders
API > API: validate cart
API > Payments: charge card

alt [label: declined] {
  Payments --> API: 402
  API --> Shopper: Payment failed
} else [label: charged] {
  API --> Shopper: 201 Created
}
note over API, Payments: idempotency key on every charge
```

| Syntax | Meaning |
| --- | --- |
| `Name [icon: …, color: …]` | Participant; columns follow the order names first appear |
| `A > B: label` / `A --> B: label` | Call / reply (dashed); `A > A` is a self call |
| `alt [label: x] { … } else [label: y] { … }` | Alternatives; also `loop`, `opt`, `par` (with `} and {`), `critical`, `break` |
| `note over A, B: text` | Also `note left of A:` and `note right of A:` |
| `autonumber` | Number every message |

### ER diagrams

Start the file with `diagram er`:

```
diagram er
title Shop database

users [icon: user] {
  id uuid pk
  email string unique
  deleted_at timestamp null
}
orders {
  id uuid pk
  user_id uuid fk
}

orders.user_id > users.id: places
```

| Syntax | Meaning |
| --- | --- |
| `name [icon: …, color: …] { … }` | Table; one column per line: `name type`, then any of `pk`, `fk`, `unique`, `null` |
| `a.col > b.col` | Many-to-one (crow's foot on `a`) |
| `a.col < b.col` / `a.col - b.col` / `a.col <> b.col` | One-to-many / one-to-one / many-to-many |
| `a.col --> b.col` | Dashed: optional relationship |
| `a > b` | Table to table, when the column doesn't matter |

Relationship lines attach to the referenced column rows. `direction` works as in flow diagrams.

### Icons

Write `icon: <name>`; open **Syntax** in the app to search all ~4,700 icons by pack (click one to copy it).

- **AWS**: `aws-<service>`, e.g. `aws-lambda`, `aws-s3`, `aws-dynamodb`, `aws-api-gateway`, `aws-sqs`, `aws-ecs`, `aws-rds`, `aws-cloudfront`
- **Azure**: `azure-<service>`, e.g. `azure-functions`, `azure-app-service`, `azure-cosmos-db`, `azure-sql`, `azure-service-bus`, `azure-aks`
- **Google Cloud**: `gcp-<service>`, e.g. `gcp-cloud-run`, `gcp-bigquery`, `gcp-pubsub`, `gcp-gke`, `gcp-sql`, `gcp-cloud-storage`
- **Tech logos**: `postgres`, `mysql`, `mongodb`, `redis`, `kafka`, `rabbitmq`, `elasticsearch`, `snowflake`, `kubernetes`, `docker`, `nginx`, `stripe`, `openai`...
- **Generic**: `user`, `server`, `db`, `cache`, `queue`, `cdn`, `load-balancer`, `worker`, `mobile`, `browser`, or any [Lucide](https://lucide.dev/icons) name

Spelling is forgiving: `aws-dynamodb`, `aws-dynamo-db` and `AWS DynamoDB` all work. Unknown icons show a warning in the editor.

Connectors must have spaces on both sides, so names like `auth-service` work. Nodes used in a connection but never declared are created automatically.

## Project layout

```
diagrams/     your diagrams as .lw files (shared by the app and the MCP server)
mcp/          MCP server and CLI: tools, syntax guide, validation, icon search, PNG rendering
server/       file store, workspace API with live events, app server, Vite plugin
src/
  dsl/        parser + types for the diagram language (pure, unit tested)
  icons/      icon name resolution shared by the browser and Node
  layout/     converts a parsed diagram into positioned nodes/edges via ELK
  render/     SVG renderer, icon resolution, color themes
  components/ editor, pan/zoom canvas, help panel
  export.ts   PNG/SVG export and share-link encoding
```

## Roadmap

- Sequence diagrams and entity-relationship diagrams
- Real-time collaboration (Yjs) and a hosted backend for saved documents
- Freeform whiteboard layer alongside code-generated diagrams
- Markdown docs that embed live diagrams

## License

MIT. The Geist fonts in `mcp/fonts/` are by Vercel under the SIL Open Font License (`mcp/fonts/OFL.txt`). Cloud and technology icons come from [`@likec4/icons`](https://github.com/likec4/likec4) (MIT), which packages the official AWS, Azure and Google Cloud architecture icon sets; those icons and logos remain trademarks of their owners and are intended for architecture diagrams.
