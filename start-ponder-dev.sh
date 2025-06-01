# Default values
PORT=${1:-42069}
CONFIG_FILE=${2:-""}

SCHEMA="public"

# Build the command
CMD="pnpm dev"

# Add config if specified
if [ -n "$CONFIG_FILE" ]; then
  CMD="$CMD --config $CONFIG_FILE"
fi

# Add port and schema
CMD="$CMD --port $PORT --schema $SCHEMA"

# Execute the command
eval $CMD