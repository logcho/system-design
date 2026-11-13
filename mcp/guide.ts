/** The diagram language, written for an AI agent that is about to draw. */
export const SYNTAX_GUIDE = `# Linework diagram language

A diagram is plain text. Layout is automatic: you describe components, groups
and connections; never give coordinates.

## Directives
direction right            right (default) | down | left | up
title Photo sharing on AWS shown above the diagram

## Components
User [icon: user, color: blue]
Orders DB [icon: postgres, shape: cylinder]
- A name is everything before "[". Names may contain spaces and hyphens and are case-sensitive.
- Attributes: icon, color, shape (rect | oval | diamond | cylinder), label (display text).
- Colors: blue indigo purple pink red orange yellow green teal cyan gray black, or #hex.

## Groups (nest freely)
AWS Cloud [color: orange] {
  VPC [icon: aws-vpc] {
    API [icon: aws-lambda]
  }
}
"{" ends the group's line; "}" stands alone on its own line.

## Connections (connectors need a space on both sides)
A > B          arrow            A < B     reverse arrow
A <> B         both directions  A - B     plain line
A --> B        dashed arrow     (also <--, <-->, --)
A > B: label   label after the last ":"
A > B > C      chain            A > B, C  fan out (also A, B > C)
A > B [color: red]
A component used in a connection but never declared is created automatically,
so a typo silently makes a stray box: declare components first, then connect.
A group cannot connect to its own contents.

## Icons
- AWS: aws-<service>     aws-lambda aws-s3 aws-dynamodb aws-api-gateway aws-sqs aws-sns
                         aws-ecs aws-eks aws-rds aws-aurora aws-cloudfront aws-route53
- Azure: azure-<service> azure-functions azure-app-service azure-cosmos-db azure-sql
                         azure-service-bus azure-aks azure-blob azure-key-vault
- GCP: gcp-<service>     gcp-cloud-run gcp-bigquery gcp-pubsub gcp-gke gcp-sql gcp-cloud-storage
- Tech logos:            postgres mysql mongodb redis kafka rabbitmq elasticsearch
                         snowflake kubernetes docker nginx stripe openai github
- Generic concepts:      user users server db cache queue cdn load-balancer worker
                         mobile browser api gateway auth analytics
When unsure of a name, call search_icons rather than guessing.

## Writing good system designs
- Declare all components first (grouped by boundary: cloud, VPC, region, cluster),
  then all connections in reading order.
- Label connections with the protocol or payload (HTTPS, gRPC, "order.created").
- Use dashed arrows for async flows (queues, events, replication).
- Prefer direction right for request flows, down for pipelines and hierarchies.
- Layout follows connection direction. When something flows back to an earlier component
  (a push notification to the client, a callback), write it from the earlier side so that
  component keeps its place: "Rider App <-- Notifications: push", not
  "Notifications --> Rider App: push". Both draw the same arrow.
- After writing, call render_diagram and look: fix crossings, stray boxes and long detours.
- Keep one diagram to roughly 25 components; split bigger systems into several diagrams.

## Example
title URL shortener
direction right

User [icon: user, color: blue]
Edge {
  CDN [icon: aws-cloudfront]
  Load Balancer [icon: aws-elb]
}
App [color: green] {
  Write API [icon: aws-lambda]
  Read API [icon: aws-lambda]
}
Cache [icon: redis]
URLs [icon: aws-dynamodb]
Clicks [icon: kafka]

User > CDN > Load Balancer
Load Balancer > Write API: POST /shorten
Load Balancer > Read API: GET /:id
Write API > URLs
Read API > Cache
Cache --> URLs: on miss
Read API --> Clicks: click event
`;
