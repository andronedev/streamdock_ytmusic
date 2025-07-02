#!/bin/bash

# This script builds and installs the StreamDock plugin for YouTube Music.
# Only tested on macOS.

# Navigate to the plugin's build directory
cd streamdock_plugin/plugin

# Run the build command
npm run build

# Navigate back to the project root
cd ../..

# Define source and destination paths
SOURCE_DIR="./streamdock_plugin"
DEST_DIR="/Users/$USER/Library/Application Support/HotSpot/StreamDock/plugins/dev.androne.plugin.streamdock.ytmusic.sdPlugin"

# Close StreamDock application
echo "Closing StreamDock..."
killall "StreamDock"

# Remove existing plugin directory at destination
echo "Removing existing plugin at $DEST_DIR..."
rm -rf "$DEST_DIR"

# Copy the built plugin to the destination
echo "Copying plugin from $SOURCE_DIR to $DEST_DIR..."
cp -r "$SOURCE_DIR" "$DEST_DIR"

# Reopen StreamDock application
echo "Reopening StreamDock..."
open -a "StreamDock"

echo "Plugin built and installed successfully! StreamDock restarted."