export interface Example {
  name: string;
  code: string;
}

export const EXAMPLES: Example[] = [
  {
    name: 'AWS serverless',
    code: `title Photo Sharing on AWS
direction right

User [icon: user, color: blue]

AWS Cloud [color: orange] {
  Edge {
    Route 53 [icon: aws-route53]
    CloudFront [icon: aws-cloudfront]
    WAF [icon: aws-waf]
  }
  Static Site [icon: aws-s3]
  API Gateway [icon: aws-api-gateway]
  Cognito [icon: aws-cognito]

  VPC [icon: aws-vpc, color: green] {
    Upload Fn [icon: aws-lambda]
    Thumbnail Fn [icon: aws-lambda]
    Feed Service [icon: aws-ecs]
    Aurora [icon: aws-aurora]
  }

  Photos Bucket [icon: aws-s3]
  Resize Queue [icon: aws-sqs]
  Metadata [icon: aws-dynamodb]
  Cache [icon: aws-elasticache]
  Notifications [icon: aws-sns]
  CloudWatch [icon: aws-cloudwatch]
}

User > Route 53 > CloudFront
CloudFront > WAF
WAF > Static Site
WAF > API Gateway: /api
API Gateway - Cognito: authorize
API Gateway > Upload Fn: POST /photos
API Gateway > Feed Service: GET /feed
Upload Fn > Photos Bucket: put object
Photos Bucket --> Resize Queue: s3 event
Resize Queue > Thumbnail Fn
Thumbnail Fn > Metadata
Thumbnail Fn --> Notifications: done
Feed Service > Cache, Aurora
Feed Service > Metadata
Upload Fn, Thumbnail Fn, Feed Service --> CloudWatch
`,
  },
  {
    name: 'Azure web app',
    code: `title E-commerce on Azure
direction right

Shoppers [icon: users, color: blue]
Front Door [icon: azure-front-door]
Entra ID [icon: azure-managed-identity]

Azure [color: blue] {
  App Tier {
    Web App [icon: azure-app-service]
    API Management [icon: azure-api-management]
    Orders API [icon: azure-container-apps]
  }
  Async {
    Service Bus [icon: azure-service-bus]
    Order Processor [icon: azure-functions]
  }
  Data [color: purple] {
    Catalog [icon: azure-cosmos-db]
    Orders DB [icon: azure-sql]
    Redis [icon: azure-redis]
    Blob Storage [icon: azure-blob]
  }
  Key Vault [icon: azure-key-vault]
  App Insights [icon: azure-app-insights]
}

Shoppers > Front Door > Web App
Web App - Entra ID: sign in
Web App > API Management > Orders API
Orders API > Catalog, Redis
Orders API > Orders DB
Orders API --> Service Bus: order.placed
Service Bus > Order Processor
Order Processor > Blob Storage: invoices
Orders API - Key Vault: secrets
Web App, Orders API --> App Insights
`,
  },
  {
    name: 'GCP data pipeline',
    code: `title Analytics Pipeline on GCP
direction right

Mobile Apps [icon: mobile, color: blue]
Web Clients [icon: browser, color: blue]

Google Cloud [color: blue] {
  Ingest {
    Load Balancer [icon: gcp-load-balancer]
    Collector [icon: gcp-cloud-run]
    Pub/Sub [icon: gcp-pubsub]
  }
  Process {
    Dataflow [icon: gcp-dataflow]
    Raw Events [icon: gcp-cloud-storage]
  }
  Serve {
    BigQuery [icon: gcp-bigquery]
    Vertex AI [icon: gcp-vertex-ai]
    Dashboards [icon: looker]
  }
}

Mobile Apps, Web Clients > Load Balancer > Collector
Collector > Pub/Sub: events
Pub/Sub > Dataflow: stream
Dataflow > BigQuery: aggregates
Dataflow --> Raw Events: archive
BigQuery > Vertex AI: features
BigQuery > Dashboards
`,
  },
  {
    name: 'Checkout sequence',
    code: `diagram sequence
title Checkout
autonumber

Shopper [icon: user, color: blue]
Web App [icon: browser]
API Gateway [icon: aws-api-gateway]
Orders [icon: aws-lambda]
Payments [icon: stripe]
Orders DB [icon: aws-dynamodb]
Events [icon: aws-sqs]

Shopper > Web App: Place order
Web App > API Gateway: POST /orders
API Gateway > Orders: createOrder()
Orders > Orders: validate cart
Orders > Payments: charge card

alt [label: card declined] {
  Payments --> Orders: 402 declined
  Orders --> API Gateway: 402
  API Gateway --> Web App: Payment failed
} else [label: charged] {
  Payments --> Orders: charge id
  Orders > Orders DB: put order
  Orders --> Events: order.created
  note right of Events: Fulfilment and email consume this
  Orders --> API Gateway: 201 Created
  API Gateway --> Web App: Order confirmed
}

Web App --> Shopper: Show result
`,
  },
  {
    name: 'OAuth sign-in',
    code: `diagram sequence
title Sign in with OAuth (PKCE)

User [icon: user]
App [icon: mobile, color: blue]
Auth Server [icon: auth, color: purple]
API [icon: server]

User > App: Tap "Sign in"
App > App: create code verifier
App > Auth Server: /authorize + code challenge
Auth Server > User: Login and consent page
User > Auth Server: Credentials
Auth Server --> App: Redirect with code
App > Auth Server: /token + code verifier
Auth Server --> App: Access and refresh tokens
note over App, Auth Server: The verifier proves the same app started the flow

loop [label: until the token expires] {
  App > API: Request with access token
  API --> App: Data
}

opt [label: token expired] {
  App > Auth Server: /token + refresh token
  Auth Server --> App: New access token
}
`,
  },
  {
    name: 'URL shortener',
    code: `title URL Shortener
direction right

// Clients
User [icon: user, color: blue]
Browser [icon: browser]

Edge [icon: globe, color: purple] {
  CDN [icon: cdn]
  Load Balancer [icon: load-balancer]
}

App Tier [icon: server, color: green] {
  Write API [icon: api]
  Read API [icon: api]
  ID Generator [icon: hash]
}

Data [icon: database, color: orange] {
  Cache [icon: redis]
  URL Store [icon: postgres]
}

Analytics Queue [icon: kafka]
Click Analytics [icon: analytics]

User > Browser
Browser > CDN: GET /abc123
CDN > Load Balancer: cache miss
Load Balancer > Write API: POST /shorten
Load Balancer > Read API: redirect
Write API > ID Generator: next id
Write API > URL Store: insert
Read API > Cache: lookup
Cache --> URL Store: on miss
Read API --> Analytics Queue: click event
Analytics Queue > Click Analytics
`,
  },
  {
    name: 'Microservices',
    code: `title E-commerce Platform
direction right

Mobile App [icon: mobile, color: blue]
Web App [icon: browser, color: blue]
API Gateway [icon: gateway, color: purple]
Auth [icon: auth]

Kubernetes Cluster [icon: kubernetes, color: teal] {
  Orders Service [icon: service]
  Catalog Service [icon: service]
  Payments Service [icon: payments]
  Notifications [icon: notification]
}

Event Bus [icon: kafka]
Orders DB [icon: postgres]
Catalog DB [icon: mongodb]
Search Index [icon: elasticsearch]
Stripe [icon: stripe]

Mobile App, Web App > API Gateway
API Gateway - Auth: verify JWT
API Gateway > Orders Service, Catalog Service
Orders Service > Payments Service: charge
Payments Service > Stripe
Orders Service > Orders DB
Catalog Service > Catalog DB
Catalog Service --> Search Index: sync
Orders Service --> Event Bus: order.created
Event Bus --> Notifications
`,
  },
  {
    name: 'CI/CD pipeline',
    code: `title Deploy Pipeline
direction right

Developer [icon: user]
Repo [icon: git, color: gray]

CI [icon: workflow, color: blue] {
  Lint [shape: oval]
  Unit Tests [shape: oval]
  Build Image [icon: docker]
}

Registry [icon: archive]
Staging [icon: server, color: yellow]
Approve? [shape: diamond, color: purple]
Production [icon: server, color: green]
Rollback [shape: oval, color: red]

Developer > Repo: git push
Repo > Lint > Unit Tests > Build Image
Build Image > Registry: push
Registry > Staging: deploy
Staging > Approve?
Approve? > Production: yes
Approve? --> Rollback: no
`,
  },
  {
    name: 'Flowchart',
    code: `direction down

Start [shape: oval, color: green]
Receive request
Authenticated? [shape: diamond, color: purple]
Rate limited? [shape: diamond, color: purple]
Handle request [color: blue]
Return 401 [color: red]
Return 429 [color: orange]
Done [shape: oval, color: gray]

Start > Receive request > Authenticated?
Authenticated? > Rate limited?: yes
Authenticated? > Return 401: no
Rate limited? > Return 429: yes
Rate limited? > Handle request: no
Handle request, Return 401, Return 429 > Done
`,
  },
];

export const DEFAULT_CODE = EXAMPLES[0].code;
