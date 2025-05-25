# Default values
PORT=${1:-42069}
SCHEMA_PREFIX=${2:-"public"}
CONFIG_FILE=${3:-""}

timestamp=$(date +%Y%m%d%H%M%S)

SCHEMA="public-$SCHEMA_PREFIX-$timestamp"

# Build the command
CMD="pnpm start"

# Add config if specified
if [ -n "$CONFIG_FILE" ]; then
  CMD="$CMD --config $CONFIG_FILE"
fi

# Add port and schema
CMD="$CMD --port $PORT --schema $SCHEMA"

# Execute the command
eval $CMD