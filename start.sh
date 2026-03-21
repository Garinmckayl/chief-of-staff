#!/bin/bash
# Start Chief of Staff MCP server
# Run this once after opening the Codespace:
#   bash start.sh
#
# Then in Copilot Chat (agent mode), type:
#   "Give me my morning briefing"

if [ -z "$NOTION_API_KEY" ]; then
  echo ""
  echo "ERROR: NOTION_API_KEY is not set."
  echo ""
  echo "Set it as a Codespace secret at:"
  echo "  github.com/settings/codespaces"
  echo "  → New secret → Name: NOTION_API_KEY"
  echo ""
  exit 1
fi

echo "Building..."
npm run build

echo ""
echo "Starting Chief of Staff MCP server on port 3333..."
echo "MCP endpoint: http://localhost:3333/mcp"
echo ""
echo "VS Code will forward the port automatically."
echo "Open Copilot Chat in agent mode and type:"
echo "  'Give me my morning briefing'"
echo ""

npm run start
