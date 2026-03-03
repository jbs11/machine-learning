import { Config } from "@remotion/cli/config";

// Pre-allocate enough audio tags for all narration clips (7 per video)
Config.setNumberOfSharedAudioTags(8);

// Use JPEG frames for faster Studio preview rendering
Config.setVideoImageFormat("jpeg");

// Override output without prompting
Config.setOverwriteOutput(true);
