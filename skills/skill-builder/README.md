# Skill Builder

This skill helps create or update a SKILL.md file for Claude based on source documentation.

## SKILL.md Generation or Update

When you run this skill, provide a source file or folder reference (typically human-written documentation). The skill will:

- **Generate** a new SKILL.md from scratch if none exists in the directory
- **Update** an existing SKILL.md with changes from the source documentation if one is already present

The generated SKILL.md follows Claude's skill best practices for conciseness and clarity.

## Custom Instructions with .skill.md

Place a `.skill.md` file in the same directory as your source documentation to provide custom instructions. Use it to:

- Specify where the SKILL.md should be created or updated (if different from the source directory)
- Add project-specific requirements or guidelines
- Override default skill-building behavior

If `.skill.md` directs you to a different directory, the skill will follow those instructions and look for additional `.skill.md` files in that directory as well.
