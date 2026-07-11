# AGENTS.md
## Project
RANKMAKER is a website that lets you create accurate rankings for movies, music, video games, sports, etc. through 1v1 battles, instead of the repetitive and inaccurate tier lists.
This repository is a VERY EARLY WIP. Proposing sweeping changes that improve long-term maintainability is encouraged.
## Terminology
* Template / ranking template: The set of options, description, title, images, etc. that you select to create a ranking.
* Ranking: The ordering of the options from a template.
> Note: you may find these terms used interchangeably within the repository, and I might even do the same on occasion myself. I just want you to be aware of this for how YOU communicate and design.
## Product priorities
* Rankings with transitivity that require as few matchups as possible to complete the ranking.
* Users should be able to share their rankings and templates in an easy, intuitive way that favors virality on social media.
## Maintainability
Long term maintainability is a core priority. If you add new functionality, first check if there is shared logic that can be extracted to a separate module. Duplicate logic across multiple files is a code smell and should be avoided. Don't be afraid to change existing code. Don't take shortcuts by just adding local logic to solve a problem.