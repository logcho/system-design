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

```bash
npm install
npm run dev
```

Other scripts: `npm test`, `npm run build`, `npm run typecheck`, `npm run mcp` (start the MCP server on stdio).

## Let an AI agent draw: the MCP server

Linework ships an [MCP](https://modelcontextprotocol.io) server, so Claude (or any MCP client) can create and edit diagrams while you watch them draw in the app.

Diagrams are plain `.lw` files in `diagrams/`. The dev server watches that folder, so changes from any source (the app, an agent, your text editor) show up live in the browser, and your edits in the browser are saved back to the file.

**With Claude Code**, the repo's `.mcp.json` registers the server. Open Claude Code in this folder and approve the `linework` server, or add it by hand:

```bash
claude mcp add linework -- npx tsx mcp/server.ts
```

Then run the app with `npm run dev` and ask for a design, e.g. *"Draw the backend for a ride-sharing app on AWS."*

**Other MCP clients** (e.g. Claude Desktop) can run the same command. Set `LINEWORK_DIR` to an absolute diagrams folder and `LINEWORK_URL` if the app isn't on `http://localhost:5173`:

```json
{
  "mcpServers": {
    "linework": {
      "command": "npx",
      "args": ["tsx", "/path/to/linework/mcp/server.ts"],
      "env": { "LINEWORK_DIR": "/path/to/linework/diagrams" }
    }
  }
}
```

| Tool | What it does |
| --- | --- |
| `get_syntax_guide` | The diagram language, with tips for clear system designs |
| `list_diagrams` | Diagrams in the workspace, newest first |
| `read_diagram` | Source, current version and any problems |
| `write_diagram` | Create a diagram, or replace one (needs the version from `read_diagram`, so your edits are never overwritten) |
| `edit_diagram` | Replace an exact piece of text |
| `search_icons` | Find exact icon names: "dynamo" → `aws-dynamodb`, "cosmos" → `azure-cosmos-db` |
| `render_diagram` | Render a PNG exactly as the app draws it, plus a count of crossing connections, so the agent can look at the layout and improve it |

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
mcp/          MCP server: tools, syntax guide, validation, icon search, PNG rendering
server/       file store and the dev-server plugin that syncs diagrams/ live
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
