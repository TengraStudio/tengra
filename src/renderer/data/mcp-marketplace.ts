import {
  Activity,
  Box,
  Calendar,
  Cloud,
  Database,
  FileText,
  Github,
  Globe,
  HardDrive,
  Layout,
  Mail,
  MessageSquare,
  Search,
  Server,
  Terminal} from 'lucide-react'

export const MARKETPLACE_MCP_DATA = [
  // Developer Tools & DevOps
  {
    id: 'github',
    name: 'GitHub',
    description: 'Repository management, issues, and pull requests.',
    category: 'Developer Tools',
    author: 'Model Context Protocol',
    icon: Github,
    command: 'npx -y @modelcontextprotocol/server-github',
    tools: [
      { name: 'search_repositories', description: 'Search for repositories' },
      { name: 'create_issue', description: 'Create a new issue' },
      { name: 'get_pull_request', description: 'Get details of a PR' }
    ]
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    description: 'CI/CD, source control, and project management.',
    category: 'Developer Tools',
    author: 'Model Context Protocol',
    icon: Github, // Fallback icon as GitLab icon might not be in lucide-react basic set
    command: 'npx -y @modelcontextprotocol/server-gitlab',
    tools: [
      { name: 'list_projects', description: 'List projects' },
      { name: 'get_pipeline', description: 'Get pipeline status' }
    ]
  },
  {
    id: 'docker',
    name: 'Docker',
    description: 'Manage containers, images, and volumes.',
    category: 'DevOps',
    author: 'Model Context Protocol',
    icon: Box,
    command: 'npx -y @modelcontextprotocol/server-docker',
    tools: [
      { name: 'list_containers', description: 'List running containers' },
      { name: 'start_container', description: 'Start a container' }
    ]
  },
  {
    id: 'kubernetes',
    name: 'Kubernetes',
    description: 'Cluster operations and pod management.',
    category: 'DevOps',
    author: 'Model Context Protocol',
    icon: Server,
    command: 'npx -y @modelcontextprotocol/server-kubernetes',
    tools: [
      { name: 'list_pods', description: 'List pods in namespace' },
      { name: 'get_logs', description: 'Get pod logs' }
    ]
  },
  {
    id: 'sentry',
    name: 'Sentry',
    description: 'Error tracking and performance monitoring.',
    category: 'DevOps',
    author: 'Model Context Protocol',
    icon: Activity,
    command: 'npx -y @modelcontextprotocol/server-sentry',
    tools: [
      { name: 'list_issues', description: 'List recent issues' },
      { name: 'get_event', description: 'Get detailed event info' }
    ]
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    description: 'Manage Workers, DNS, and cached content.',
    category: 'DevOps',
    author: 'Model Context Protocol',
    icon: Cloud,
    command: 'npx -y @modelcontextprotocol/server-cloudflare',
    tools: [
      { name: 'list_zones', description: 'List DNS zones' },
      { name: 'purge_cache', description: 'Purge cache' }
    ]
  },
  {
    id: 'aws',
    name: 'AWS',
    description: 'Manage EC2, S3, and other AWS resources.',
    category: 'Cloud',
    author: 'Community',
    icon: Cloud,
    command: 'npx -y @modelcontextprotocol/server-aws',
    tools: [
      { name: 'list_buckets', description: 'List S3 buckets' },
      { name: 'describe_instances', description: 'List EC2 instances' }
    ]
  },
  {
    id: 'postman',
    name: 'Postman',
    description: 'API testing and collection management.',
    category: 'Developer Tools',
    author: 'Community',
    icon: Activity,
    command: 'npx -y @modelcontextprotocol/server-postman',
    tools: [
      { name: 'run_collection', description: 'Run a collection' }
    ]
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Issue tracking and project management.',
    category: 'Project Management',
    author: 'Model Context Protocol',
    icon: Activity,
    command: 'npx -y @modelcontextprotocol/server-linear',
    tools: [
      { name: 'create_issue', description: 'Create a new issue' },
      { name: 'list_issues', description: 'List issues' }
    ]
  },
  {
    id: 'jira',
    name: 'Jira',
    description: 'Enterprise project tracking and agile tools.',
    category: 'Project Management',
    author: 'Model Context Protocol',
    icon: Activity,
    command: 'npx -y @modelcontextprotocol/server-jira',
    tools: [
      { name: 'get_issue', description: 'Get issue details' },
      { name: 'transition_issue', description: 'Change issue status' }
    ]
  },

  // Design & Media
  {
    id: 'figma',
    name: 'Figma',
    description: 'Design inspection and comment management.',
    category: 'Design',
    author: 'Model Context Protocol',
    icon: Layout,
    command: 'npx -y @modelcontextprotocol/server-figma',
    tools: [
      { name: 'get_file', description: 'Get file content' },
      { name: 'get_comments', description: 'Get file comments' }
    ]
  },
  {
    id: 'brave-search',
    name: 'Brave Search',
    description: 'Privacy-focused web search.',
    category: 'Web',
    author: 'Model Context Protocol',
    icon: Search,
    command: 'npx -y @modelcontextprotocol/server-brave-search',
    tools: [
      { name: 'search', description: 'Search the web' }
    ]
  },

  // Databases & Data
  {
    id: 'postgres',
    name: 'PostgreSQL',
    description: 'Query and manage SQL databases.',
    category: 'Database',
    author: 'Model Context Protocol',
    icon: Database,
    command: 'npx -y @modelcontextprotocol/server-postgres',
    tools: [
      { name: 'query', description: 'Execute SQL query' },
      { name: 'list_tables', description: 'List tables' }
    ]
  },
  {
    id: 'sqlite',
    name: 'SQLite',
    description: 'Local database management.',
    category: 'Database',
    author: 'Model Context Protocol',
    icon: Database,
    command: 'npx -y @modelcontextprotocol/server-sqlite',
    tools: [
      { name: 'query', description: 'Execute SQL query' }
    ]
  },
  {
    id: 'mysql',
    name: 'MySQL',
    description: 'Relational database management.',
    category: 'Database',
    author: 'Model Context Protocol',
    icon: Database,
    command: 'npx -y @modelcontextprotocol/server-mysql',
    tools: [
      { name: 'query', description: 'Execute SQL query' }
    ]
  },
  {
    id: 'mongodb',
    name: 'MongoDB',
    description: 'NoSQL database interactions.',
    category: 'Database',
    author: 'Community',
    icon: Database,
    command: 'npx -y @modelcontextprotocol/server-mongodb',
    tools: [
      { name: 'find', description: 'Find documents' }
    ]
  },
  {
    id: 'redis',
    name: 'Redis',
    description: 'In-memory data structure store.',
    category: 'Database',
    author: 'Community',
    icon: Database,
    command: 'npx -y @modelcontextprotocol/server-redis',
    tools: [
      { name: 'get', description: 'Get value' },
      { name: 'set', description: 'Set value' }
    ]
  },
  {
    id: 'snowflake',
    name: 'Snowflake',
    description: 'Cloud data warehousing.',
    category: 'Database',
    author: 'Model Context Protocol',
    icon: Database,
    command: 'npx -y @modelcontextprotocol/server-snowflake',
    tools: [
      { name: 'query', description: 'Run query' }
    ]
  },
  {
    id: 'elasticsearch',
    name: 'Elasticsearch',
    description: 'Search and analytics engine.',
    category: 'Database',
    author: 'Community',
    icon: Search,
    command: 'npx -y @modelcontextprotocol/server-elasticsearch',
    tools: [
      { name: 'search', description: 'Search documents' }
    ]
  },

  // Productivity & Communication
  {
    id: 'slack',
    name: 'Slack',
    description: 'Messaging and team collaboration.',
    category: 'Productivity',
    author: 'Model Context Protocol',
    icon: MessageSquare,
    command: 'npx -y @modelcontextprotocol/server-slack',
    tools: [
      { name: 'post_message', description: 'Send a message' },
      { name: 'list_channels', description: 'List channels' }
    ]
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Voice, video and text communication service.',
    category: 'Productivity',
    author: 'Community',
    icon: MessageSquare,
    command: 'npx -y @modelcontextprotocol/server-discord',
    tools: [
      { name: 'send_message', description: 'Send a message' }
    ]
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Workspace for notes, docs, and databases.',
    category: 'Productivity',
    author: 'Model Context Protocol',
    icon: FileText,
    command: 'npx -y @modelcontextprotocol/server-notion',
    tools: [
      { name: 'get_page', description: 'Get page content' },
      { name: 'search', description: 'Search Notion' }
    ]
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'Local knowledge base management.',
    category: 'Productivity',
    author: 'Community',
    icon: FileText,
    command: 'npx -y @modelcontextprotocol/server-obsidian',
    tools: [
      { name: 'read_note', description: 'Read note content' }
    ]
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'File storage and synchronization.',
    category: 'Productivity',
    author: 'Model Context Protocol',
    icon: HardDrive,
    command: 'npx -y @modelcontextprotocol/server-google-drive',
    tools: [
      { name: 'list_files', description: 'List files' },
      { name: 'read_file', description: 'Read file content' }
    ]
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Time management and scheduling.',
    category: 'Productivity',
    author: 'Model Context Protocol',
    icon: Calendar,
    command: 'npx -y @modelcontextprotocol/server-google-calendar',
    tools: [
      { name: 'list_events', description: 'List events' },
      { name: 'create_event', description: 'Create event' }
    ]
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Email management.',
    category: 'Productivity',
    author: 'Model Context Protocol',
    icon: Mail,
    command: 'npx -y @modelcontextprotocol/server-gmail',
    tools: [
      { name: 'list_messages', description: 'List emails' },
      { name: 'send_message', description: 'Send email' }
    ]
  },

  // Web & Utilities
  {
    id: 'puppeteer',
    name: 'Puppeteer',
    description: 'Headless browser automation.',
    category: 'Web',
    author: 'Model Context Protocol',
    icon: Globe,
    command: 'npx -y @modelcontextprotocol/server-puppeteer',
    tools: [
      { name: 'navigate', description: 'Go to URL' },
      { name: 'screenshot', description: 'Take screenshot' }
    ]
  },
  {
    id: 'code-interpreter',
    name: 'Code Interpreter',
    description: 'Sandboxed Python execution environment.',
    category: 'Utility',
    author: 'Model Context Protocol',
    icon: Terminal,
    command: 'npx -y @modelcontextprotocol/server-python',
    tools: [
      { name: 'execute_python', description: 'Run Python code' }
    ]
  },
  {
    id: 'google-maps',
    name: 'Google Maps',
    description: 'Location and navigation services.',
    category: 'Utility',
    author: 'Model Context Protocol',
    icon: Map,
    command: 'npx -y @modelcontextprotocol/server-google-maps',
    tools: [
      { name: 'search_places', description: 'Search for places' },
      { name: 'get_directions', description: 'Get directions' }
    ]
  }
]
