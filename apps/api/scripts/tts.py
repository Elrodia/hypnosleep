#!/usr/bin/env python3
"""
Edge TTS synthesis script.
Called as a subprocess from the Node.js TTS service.

Usage:
  echo "Your script text" | python3 tts.py --voice en-US-AnaNeural --output /tmp/output.mp3
"""

import asyncio
import argparse
import sys

import edge_tts


async def synthesize(text: str, voice: str, output_path: str) -> None:
    """Synthesize text to speech using Edge TTS and save to file."""
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Edge TTS synthesis")
    parser.add_argument("--voice", required=True, help="TTS voice ID (e.g. en-US-AnaNeural)")
    parser.add_argument("--output", required=True, help="Output file path (.mp3)")
    args = parser.parse_args()

    # Read script text from stdin
    text = sys.stdin.read().strip()
    if not text:
        print("Error: No text provided via stdin", file=sys.stderr)
        sys.exit(1)

    asyncio.run(synthesize(text, args.voice, args.output))


if __name__ == "__main__":
    main()
