Running multiple Claude Code agents
at the same time is the single biggest productivity unlock in AI coding. And that's not just my opinion. It's also a direct quote from the creator
of Claude Code, Boris Cherny, who calls it the top tip from the Claude Code team. And the productivity gains are real. Building with multiple Claude Code
agents has allowed me to ship new products and build useful tools
for my business in record time. Things like research agents, a
live questions app for my courses, and tools for live teaching. but making the leap from using one
to many Claude Code agents requires more than just opening multiple tabs. You actually need a system, and I've made
a lot of mistakes along the way to getting mine dialed in to where it is today. So in this video, I'm gonna save
you months of pain by showing you my complete system for building productively
with multiple Claude Code agents. I've broken it down into three
phases: prepare, build, and ship. And we're gonna do this
with a real project. I'll take you through the whole
workflow as I build three new features in an infographic maker app. So let's get into phase one of
building with multiple Claude Code agents, and that's prepare. I'm gonna give you a quick overview of
the app that we're gonna be working on. it's an infographic creator,
so it takes in a transcript from one of my YouTube videos. so I can select a transcript that is, one
of the YouTube videos that I've uploaded. I'm gonna pick one, and then you can
pick a particular style of infographic and a topic that you wanna create. And then an output of the app is gonna be
an infographic in the style that you've chosen about the topic that you want. So in this case, it's planning in
plan mode based on the content of the transcript that you selected. this is a gallery for the app. This is, the kinds of infographics
that are being generated. And some of the things we're gonna
work on in this video is creating new styles of infographics. So you can see here there's only
a few styles, so we're gonna create new styles of infographics. And some of the other features that we're
gonna create are things like the ability to select multiple transcripts, as well
as to upload, a transcript that's not in this list and create infographics from it. So with that in mind,
let's get into the system. Okay, so step one is prepare, and the goal
in the preparation step is to prepare both the work that we wanna do, in this case,
we're gonna use GitHub Issues, and set up Claude Code correctly so that we can
easily run multiple agents in parallel. Now to organize issues, I'm
gonna be using GitHub Issues. It's free. It comes with every, GitHub repo that
you create in, the GitHub platform, but you can also easily use things
like Linear, Jira, or other task tracking or project management tools
that you or your company uses for this. But in this video, we're
gonna use GitHub Issues. Okay, so we're now in GitHub issues. You can see this is the name of
the project, AC Infographic Maker, I start by defining the tasks that
I wanna work on in parallel and creating GitHub issues for them. So you can see here, I'm in the
Issues tab for the projects, project that we're working on, And if you're
unfamiliar with issues, an issue is just any unit of work for your project. So it could be things like new
features, it could be things like bug fixes, could also be things like
enhancements to existing features. any, individual thing that you
want to work on for your project, I recommend creating an issue for it. Now in general, it's good to break
down large tasks into smaller chunks of work, so I always create issues to
help organize my project and manage the work that needs to get done. Now, for this particular project,
I've already created the tasks that we're gonna work on in parallel. They are, issue number 26, so this is
gonna be adding new infographic styles as we discussed in the app overview. I've also got issue number 44, which
is selecting multiple transcripts as input for an infographic. And I've also got, issue number
36, which is to upload transcripts to generate infographics from. Now, you'll notice that each
of these issues follow the same format and the same structure. So we've got things like description,
we've got things like acceptance criteria, and this is standard across my issues. This is how I like to
create GitHub issues. They all follow the same format. and as you can see here,
again, description and scope and acceptance criteria. This actually makes it a lot easier to get
consistent results with Claude Code, and it also ensures that the feature that you
want to implement is actually implemented in the way that you want it to be done. Now, a pro tip to easily create
issues is that I use my create issue skill, which is a custom skill that
I've created that helps me get that wonderful structure and, custom
format that I use for GitHub issues. So the way this skill works is
that it takes in a doc or a feature description, and it creates an issue
for it according to a custom template that I've defined And this helps me
standardize things like you saw things like description, acceptance criteria,
how to test the feature, etcetera. So I recommend creating a custom skill to
automate issue creation if it's something you're gonna be doing frequently. Now another key thing when you're
picking issues is to pick issues that don't touch the same external systems. We'll see this in the common mistakes
section later in the video, but I pick issues that are mostly,
application or business logic changes. they don't require drastic changes
to things like database schema or touch the same, external components. we're gonna see this more later in the
video, but this is something to keep in mind when you're selecting the issues
that you wanna work on in parallel. By the way, if you're curious about
planning, check out my other video, How I Start Every Claude Code Project, for
an in-depth look at the planning process. I also cover spec-driven development
and systems for building projects with Claude Code in my AI coding
accelerator, both of which you can find in the video description. Now that we have the issues created,
it's time to set up Claude Code to work on the issues in parallel. Now, the easiest way to do this
is just to have multiple tabs open in your terminal and have a Claude
session running in each one of those. This is what I'm gonna do for this video. So I'm using a terminal called Ghostty,
and what we're gonna do is just create two more tabs so that we can have, three
free tabs in order to run our three parallel Claude Code sessions that are
gonna build our three features at the same time that we wanna achieve in this video. Now you can also use the split
panes feature and have all your sessions running in one place. You might have seen this in my previous
videos, so you can try that as well. But for simplicity, I'm gonna pick
multiple tabs because Ghosty actually notifies me when one of them needs input. Another reason to stick with multiple
tabs is because this makes it easy to use the new agent view feature in order to
manage all parallel agents in one place. We're gonna see more about that
in the build step very soon. But first, there's still one big
question we haven't answered. How do we make sure that the agents
don't get in each other's way? You see, if we just start multiple
Claude Code sessions right now, there's a chance that they will
overwrite each other's work, just like when you have multiple people
editing a Google Doc at the same time. Now, claude A might make a change to
a certain part of the app, in this case, adding an invite feature to the
menu bar, and Claude B might make a change to that same part of the app. In this case, it wants to
add an export report feature and show up in that menu bar. But what we don't want is when
Claude A makes a change for Claude B just to overwrite that change. That defeats the whole purpose of working
on multiple features at the same time and having Claudes work in parallel. So how do we ensure that each
Claude can work independently and not get in each other's way? The answer is git worktrees, and more
specifically, giving each Claude Code agent its own worktree to work in. So what are Git worktrees? Git worktrees are separate
isolated copies of your project. Each worktree gets its own folder on your
machine, its own copy of project files. So as you can see here, every worktree
has its own copy of, in this case, the code and docs, and its own branch in Git. Now by giving each Claude Code agent its
own work tree, it enables them to work in isolation because they can make changes as
if the other Claude agents didn't exist, because they only see their branch and
make changes to their copy of the files. So the next step is to create multiple
worktrees, one for each feature and agent, and then later on, we'll
learn how to merge these results back into the main branch of the app. So look out for that in the
ship section later in the video. So we're back in the terminal, and what
I'm gonna do is create a worktree for each of the features that we're gonna work on. The easiest way to do this is actually
using the built-in worktree creation flag when you start a new Claude Code session. All you need to do in order to
take advantage of the built-in worktrees in Claude Code is use the
dash dash worktree flag when you start a new Claude Code session. So in this case, I'm running Claude Code
with dangerously skipped permissions 'cause I like to live on the edge. And then what I'm doing is adding
the dash dash worktree flag, in addition to, that command. And the pro tip here is to
give your worktree a name. So what I'm gonna do is name each
of my worktrees after the issue number that it corresponds to. So in this case, I'm gonna call it
issue-26, and what that's gonna do is create a worktree with the name issue-26. So we're gonna press Enter, and
what we're gonna see is a new Claude session that is going to be created. So what this does, it starts a new
Claude Code session inside a worktree, and it creates the worktree for you. So in this case, you can see here we
are in a worktree called issue-26, and that worktree is actually stored in the
.claude folder in your project directory. So .claude/worktrees/worktree-name, in
this case, issue-26, is where we are. So we did this for one of the issues. Let's go ahead and create worktrees for
every issue that we're gonna work on. I'm gonna create a worktree
for issue number 36. And a pro tip here is that you can also
just type /w instead of --worktree. So -w is going to give you, the same
impact as --worktree in terms of automatically creating a worktree. And in this case, it's gonna be issue 36. So let's create a worktree for that issue. And as you can see here, we now are
in a Claude Code session that is running inside the worktree folder,
in this case, worktree for issue 36. And then finally, let's go ahead and
create our worktree for the final issue that we're gonna work on. In this case, it's gonna be issue 44. I'm going to just use the, shorthand
flag, -w, and it's gonna be issue 44. So what we have here is we've successfully
created, three worktrees, one for each feature that we're gonna be working on. And we started a Claude Code
session inside that worktree, all in just, a single prompt or
all in just three prompts, one for each, Claude Code session. You can also just leave the name
field blank, and just use --worktree or -w, and Claude will give you
an auto-generated name as well. I just want to touch on something
that I mentioned earlier, which is where the worktrees that are
created by Claude Code live. Now, by default, the worktrees that
you create using the dash worktree command or dash W command live in,
the .claude folder, in particular the .claude/worktrees directory by default. So you can see here, if you have a folder
called My Project, for each Claude Code project, you're gonna have a folder called
.claude, which is gonna store various Claude Code-related, files and settings. And then inside the .claude folder, you're
going to have your worktrees folder that's gonna, be the home for all the different
worktrees that you're gonna create. So in this case, we have three
worktrees, one for each of the features, worktree one, two, and
three, and it's in those directories. So for example, starting a Claude
Code session, using the worktree flag is gonna start your Claude
Code session in that directory. And here you can clearly see the isolation
between the different folders because you have, Claude Code sessions running
in each of those folders, and that's how they don't conflict with each other,
in addition to having their own git branch that gets created automatically. So now that we have our issues and
we have our work tree set up, it's time for step two, the build step. The build step is where
the action happens. It's where we give Claude the issues
to work on and use Agent View to monitor the progress of all our agents. Now, the main part of the build
step is to kick off Claude Code working on each feature. So what I'm gonna do is just prompt
Claude Code by giving it the issue to work on, and all I'm gonna do is just
simply, put Claude Code in plan mode, and I'm gonna give it the issue to work on. In this case, let's implement
issue number twenty-six. Now, what's gonna happen here is that
Claude Code is going to use the GitHub CLI in order to read that GitHub issue
and get the information from there. it's easier than just typing all that out. And you can see here, I'll start by
reading issue twenty-six to understand what needs to be implemented. So we're gonna do that
for each of our issues. once again, putting Claude into
plan mode first, and then, asking it to implement the issue number that
corresponds to the work tree branch name. So in this case, it's gonna
be issue thirty-six, and Claude is gonna work on that. And finally, it's going to be issue
number forty-four, which is going to be the final issue that we're gonna work on. And once again, I start all these
sessions in plan mode, and I actually do that for a very specific reason. And that reason is that for each feature,
I recommend following what I call the RPIT build loop, which stands for
research, plan, implement, and test. Now, the RPIT loop is especially important
when building with multiple agents because it helps you ensure that what you're
building actually works and that the feature actually works as you intended to. Now, the RPIT loop is pretty simple. You can, implement it in
a very lightweight way. You can, go crazy and have, very in-depth
implementations for each of the steps. But for example, the research step could
just be creating a research report on APIs or things that Claude might need
to reference when building the feature. Planning could just be as simple as
chatting to the agent in order to create a plan and get clear on which
files and what needs to change, or it could just be as simple as using
plan mode, which is what I've done in the examples, that you've just seen. And then implement is where, Claude
cooks and it implements the features. And then finally, testing
is super important. This is where Claude will automatically
test its work to make sure that its implementation is correct and that the
feature is actually built properly. this is, where you can use things like
acceptance criteria in order to help Claude, as well as use things like the
Playwright MCP in order to auto-test the UI, uh, as an example for testing. Now you can just let the three
Claude Code agents run and switch tabs every so often to monitor them. But wouldn't it be cool if we could
see all our sessions in one place and get notified when our input is needed? That's where Agent View comes in. Agent View is a new feature in Claude
Code, and it's the sort of new feature that I cover in the What's New section
of my weekly newsletter on AI coding. There's a link in the description
if you'd like to get that delivered to your email inbox every weekend. to use Agents View, the first step is to
make the session run in the background. To do that, we're just gonna
type slash bg to background the session after we've created it. And what that's gonna do is
actually move the session from the terminal window into the background. So what we're gonna do is just do
that for all of the sessions that we started, and we're gonna see how
to, recover them in just a moment. So let me accept that plan, and
we're gonna background the session. Step two of using Agent View is to
open up a new terminal window and use the command Claude agents in
order to open up the agents view. Now, what this is gonna do is actually
open up this agent command center that is a dashboard with all their agents
that we have running and their statuses. And what's gonna happen is that Claude
is actually gonna notify us of which agents need our attention, and we can
also, switch in and out of the sessions as I'm gonna show you, right now. So in addition to looking at, the status
of all the agents, at a high level, what we can do is just click into each of the
issues to see how the agent is doing. So in this case, I'm back in issue
forty-four, and to go back, you can see, we just hit the, left key,
in this case the back button, in order to go back to the agent view. And we can click in and out
of every session in order to see, what the agent is doing. in this case, this agent is planning,
and we can go back and we can also see. In addition to the sessions that are for
this particular project, you can also see your sessions across all your projects. So in this case, a little Easter
egg is, I'm redesigning the landing page for my newsletter, and this
is stuck on, approving a plan. So if I wanted to, I could go and
inspect what's going on in that session. this allows you to build really
productively, not just with multiple Claude Code agents in one project, but
with multiple Claude Code agents running across multiple projects at the same time. And in the agents view, you can
see we have this nice separation between the agents that are working
and the agents that are completed. And we can see, super clearly
the status of each of our agents. And as I mentioned, going between
agent session is as easy as just clicking in and out of the agents. and you can see here I'm back in, agent
that's working on issue twenty-six, and we can inspect its task list
and see that, hey, it's actually almost im-- finished implementing the
feature, and it's now just running the tests and, testing the UI. Now, in this case, this is a good example
of, a case where the agent needs input. So when an agent needs input, you
can see here I've got to approve the plans for the agents working on issue
forty-four and issue thirty-six. This is the beauty of agent view because
it's such a cool way to manage each session at a glance versus having all
the output on your screen at the same time and having Claude, flashing changes. That's, can be a bit overwhelming. This is a really cool way to check
on any session and easily switch in and out of different sessions. Now remember the RPIT build loop
where the T stands for test. A pro tip is always to make sure that
Claude has tested the feature and verified that each feature works before proceeding. We can see here, for example, that
this Claude session is using the Playwright plugin in order to run
tests, build the app, and then verify the UI using Playwright. Now, remember, we included things
like acceptance criteria in our task descriptions and GitHub issues. That's another way, in order
to make sure that Claude tests its work before it's finished. And you can also have things like
instructions in your claude.md file in order to give Claude
the testing instructions that it needs in order to, test the app. As you see fit. So what I'm gonna do is approve Claude's
plans, and then I'm gonna step away and let Claude work on the three features, and
we'll check back in on it once it's done. So the final step that I like to do in
the build process for sessions that have completed, so for example, this feature
26, the format picker, let's just click into that, is run a skill that I've
created called Update Docs and Commit. Now, what this skill is gonna do is
update the docs in the docs folder. In this case, I have
things like a change log. I have things like an architecture.md
file, other documentation for the project, and then commit this to Git. So this is just a cool way to make sure
that the code and the documentation for the project stay up to date. And then in step three, when we do the
ship and the merge, we're going to be able to update both the code and the docs. That's gonna make it a lot easier
and a lot faster, and just keep your project in sync and, interpretable
for both humans on your team as well as, of course, for Claude Code that's
gonna be working on your project. So Claude has successfully implemented
the three features that we asked it to. You can see these are the three agents
that have successfully completed. The other agents that were still working
at the time are still running, but we're not gonna worry about those for now. And so we've successfully, implemented
all three of our features, and now that our features have been built
and tested, it's time for step three, which is the ship step. In the ship step, we're gonna take
the features that we just built in our worktrees and merge them back
together into the main project. So a visual illustration of this is,
say we have three worktrees that worked on three different features, So you
have, one that worked on this feature Invite Team, one that, worked on this
feature Export Report, and one that worked on a Search Project feature. In contrast to the situation we saw
at the start of the video where it overwrote each other, what we actually
want to do is take all these features and merge them such that they can live,
happily together and live, alongside each other in the final working app. And so that step is gonna involve a merge,
and, we're gonna see a situation where in our final UI, we'll have all the features
that each of the three Claude Code agents worked on living harmoniously and working
properly in the final application. So let's see how this is done. Now, depending on your project or team
situation, you have a few different options and a few different methods to
pick from when you wanna merge the work in the different worktrees together. So let's start with method
one, which is PR review. If you're in a large team or you're making
changes to a production application, this is who I think should use this
method, and the method is pretty simple. You create one PR per worktree,
and then you have Claude review and merge the PR one at a time. Now, the reason why this is, a good
method is because it's the safest way to make changes to your app. You're, creating a PR, having
Claude review that PR, and then merging the PRs one at a time. So this is the safest way, but it's
also probably the slowest out of the three ways, and so that's the
trade-off that you're making with this. And again, you'd use this if you're
working in a large team, if you're working in enterprise, this is
probably a standard method, and when working on production apps. Method two is what I'm calling
the feature branch method. If you're on a small team or a solo
builder who wants to move a bit faster but who still wants a safety
net, I recommend using this method. This is where you ask Claude to
merge all the worktrees together into a new feature branch. Now, doing this makes it easy to
validate the changes without risking the stable version of your app. So you can test all the new features
in a dev environment, for example, in Vercel Preview or whatever,
preview environment that you have. And then once you're happy,
you can merge into main. This is a method that I personally
use the most often, and so this is what I'm gonna show you in this video. In the ship step, merging the
different worktrees together into a feature branch is super simple. All you gotta do is create a new Claude
Code session in the, root of your project. So in this case, you can see
I'm no longer in a worktree. I'm in my main folder called AC
Infographic Creator, and all I'm gonna do is just ask Claude to merge the
worktrees for the specific issues together and then resolve all merge conflicts. So the prompt would look
something like this. It would say, "Hey Claude, please merge
the worktrees for issues, 44, 36," and let's make sure we got the right one. Correct. 44, 36, and this one is 26. "And 26 together into a new feature
branch for further testing on dev," further testing in a preview environment and then the most important part of
this prompt is gonna be asking Claude to please resolve, any conflicts And ensure all three features
work as intended in the final app. So this is the prompt that you're gonna
use, and the cool part about this is that you can get Claude to handle things
like messy Git operations, things like merging and resolving conflicts for you. This takes advantage of the fact that
Claude has full context of how the app is supposed to behave, and so it can
make judgment calls or even ask for your input to ensure that all three features
get incorporated into the app correctly. So this is a prompt that I, am using,
and again, this is a method that I use as a solo builder who's, wanna move fast
but also wanna move a bit cautiously. Again, if you're in an enterprise, if
you're working in a larger company, just create one PR for every work tree and
every change that you've made, and review and then merge those PRs one at a time. And the good thing about this method
is that Claude is going to take care of the complexities of things like the
order in which to merge your, worktrees. So over here you can see Claude has says,
"Hey, I'm gonna set up the merge and bring them in sequentially, starting with
the smallest," and then it's gonna do twenty-six, thirty-six, then forty-four. So Claude will pick an order,
and the right order in which to make these, merges in so that all
three features work as intended. This is the advantage of, using Claude
Code for these kinds of, merge operations, in the final step, which is the ship step. Back to the three work tree merge methods. The final method is method three,
which I'm calling straight to main. So if you're a solo builder that wants
to move super fast and doesn't mind YOLO mode, you can ask Claude to merge
all three work trees straight into the main branch and resolve conflicts. This is both the fastest method,
but it's also the riskiest 'cause you're merging straight into main. So you can use this if you wanna live
in YOLO mode, but if not, I recommend using either method one or method two. Okay, so Claude is actually done
merging the three worktrees together. Let's take a look at what it did. Claude went ahead and merged the
three worktrees together, but then it also resolved, multiple conflicts
between the worktree branches. So for example, you can see here resolve
one conflict, and for issue forty-four resolve nine conflicts across, the various
parts of the app, A cool thing to note is that it also made a follow-up fix. So for example, this was something that
as a result of the merging the three things together was broken in the app,
and Claude went ahead and fixed that. And then probably one of the most
important things to keep in mind in having Claude Code handle things like
merging multiple worktrees together is giving it a way to verify its own work. So in this case, what I went
ahead and did is gave Claude various means to test the app. So it, the app had tests that Claude could
run, and you can see here forty-three out of forty-three of them passed. And then it was also able to build
the application, and then Claude was able to run some end-to-end tests
for the app and both of those passed. And what I also gave Claude the
ability to do is to test the app and to use browser simulation to test
the app using the Playwright MCP. And in this case, Claude ran, in the
browser and tested all seven formats. It did multi-select, which was one of
the, issues that we were implementing, and it also tested transcript uploads. and I also mentioned it
implemented the new infographic styles that we asked it to. So in this case, Claude did both an
end-to-end test, and it did an actual, user simulation test in the browser. So Claude has successfully not just merged
the things together, but gone ahead and done further testing and verification
to ensure that it works correctly. the important part is Claude
has full knowledge of how the app is supposed to work. It knows about these three features
and is able to merge them correctly so that the app works as you intend. So before we see the app in action,
there's one last step in the ship section, which is worktree cleanup. Now when we're done merging the
changes from each Claude agent into the app, I've created a custom
skill called cleanup worktrees. Now what this does is after a session
where I work with multiple Claude Code agents at the same time, it
will remove the git worktrees from my .claude/worktrees folder and delete
the branches because those branches have already been merged into a feature
branch for further testing or if there have been PRs that have been created
and successfully merged into the app. And remember, worktrees are
copies of your code base. They're isolated copies of your
folder, and so you don't want to have too many old ones lying around
that's just having multiple copies of your project for no reason. And so we're gonna use this, skill
/cleanupworktrees in order to clean up the worktrees that we, don't need. So cleanup worktrees just
finished, and we can see what Claude has gone and done here. So it's removed the three worktrees
that we've created for this project, in this case for issue twenty-six,
thirty-six, and forty-four. And it's also gone ahead and removed
the branches that we used that were associated with those worktrees. but it's kept the .claude/worktrees
folder, which is where all the worktrees that Claude
automatically creates are kept. And most importantly, we have
the final merged branch, the preview branch, that's called
preview-twenty-six-thirty-six-forty-four, which is a creative name
that Claude came up with. And, Claude also pushed some
additional follow-up fixes. So again, this is where the power
of, having a system for working with multiple Claude Code agents, and
I've created these custom skills that help me with repetitive tasks. And in this case, the skill is, cleanup
worktrees, which allows me to make sure that, at the end of building with
multiple Claude Code agents, we clean up the worktrees and, we don't have a
bunch of, stale worktrees lying around. We've successfully applied the system
to work with multiple Claude Code agents at the same time in order to build three
features for this infographic creator app. I want to demo the final product
to you so that, you can get a sense that these features actually work. Claude did actually test and verify
these features by itself, but I'm just gonna demo them for you so
that you can see them in action. remember we implemented three features. the first one was the ability
to upload a transcript. you can see there's a new upload
button that has been created. this button could probably be slightly
different, but for an MVP, this is fine. So let us go ahead and select
Upload, and I'm going to have a new transcript that I'm gonna upload,
by the Claude Code desktop app. A good video if you
haven't checked it out. So in this case, this is
uploading a transcript. And the second feature that we
implemented was the ability to select multiple transcripts for a video. So in addition to the uploaded
transcript, I'm going to go ahead and select this twelve months of Claude
Code lessons in forty-five minutes. So this will be the two
transcripts that I'm gonna select. And you can see here that this
feature of allowing the user to pick multiple transcripts to generate,
infographics from is, implemented with a nice checkbox functionality. So this seems like it's
implemented correctly. So we're gonna select
those two transcripts. And then the third feature that
Claude went ahead and implemented are new infographic styles. So I have new infographic styles. In this case, we have things like
whiteboard, poster, table, anatomy. I like whiteboard, so we're gonna use
whiteboard for this one, and we're gonna go ahead and test all these
three features at the same time. I'm actually gonna select the topic
of, working with multiple Claude Codes at the same time with git wattrees. of course, this video was about
working with multiple Claude Codes at the same time with git wattrees. You can see Claude is, going
ahead and generating that image. So we'll wait for Claude to generate that
image and check back in when it's done. And there you have it. We've successfully generated
an infographic using the new features that the three Claude Code
agents were implementing for us. So you can see here we have successfully,
generated an infographic with a new style called Whiteboard, and this infographic
is about working with multiple Claude Codes at the same time with git worktrees. That's the topic of the video,
so it's a cool meta thing. And we're using the new
features that we have. So for example, we selected multiple
transcripts, we uploaded a transcript, and we're using the new Whiteboard style,
which is, the style in which you can see the infographic has been generated. So this is just to show you that,
working with multiple Claude Codes at the same time and having a system for
building, and following things like the RPIT build process and using git
worktrees can actually yield good results and, is the way that I recommend using
multiple Claude Codes at the same time. Now that we've seen the system in
action, let's look at some common mistakes and how to avoid them. But before we get into that, if you like
my system for building with multiple Claude Code agents and want to apply this
to your own projects and just massively level up how you or your team work with
Claude Code in general, I've just opened new cohorts on my AI coding accelerator
ship with Claude Code and Codex. It's the fastest way to get ahead of
the curve with AI coding, and you can use the link in the video description
for a YouTube exclusive discount. Now here are the top five most
common mistakes and things to keep in mind when using Git worktrees
with multiple Claude Code agents. Number one is forgetting that git
worktrees only cover what's in your git repo, not external systems. The mistake here is thinking that when
you create a git worktree, it's gonna also create copies of things like your hosted
database or your cloud object storage. Git worktrees only apply to the files
and folders inside the worktree itself. That's your application code, your docs,
and whatever else is in your direct repo that you're creating a worktree from. Worktrees don't apply to external
systems like cloud databases, like Supabase or MongoDB Atlas,
object storage like Cloudflare R2 or AWS S3, or webhook-dependent
flows with a single webhook URL. For example, Stripe is
a common use case here. So if you're using those, you need to
be careful of the Claude Code agents making changes on the same thing. For example, multiple agents
changing a database schema. So how do you solve this? The best solution is to plan your work
ahead of time so that you don't have three features which all touch the
database or are all testing the Stripe checkout workflow at the same time. Instead, maybe have one feature that
touches the database and the other two are just UI or business logic ones. This is why the preparation step
at the start of the video is so important, 'cause it helps us move
faster by avoiding mistakes like this. To pick good issues to work on at
the same time, just ask Claude. Give Claude different groups of features
that you're planning to work on and ask it to spot which ones might be the best
to work in parallel or which ones might have mistakes that, you'd rather avoid. Another solution is having some
isolation at the layer of your resource. For example, giving Claude its own
local database, instead of a hosted one or its own database branch, for
example, if you're using a hosted database like Supabase or Neon. Another common issue is
running out of tokens. Building with five Claude Code agents
will use up your session limits on your Claude Code subscription five times
as fast as just building with one. However, I personally find the
productivity trade-off to be worth it, and I mitigate the impact by
using the Claude 20X Max plan for two hundred dollars a month, which
I found has generous limits for my use cases and just in my experience. To avoid running out of tokens, you can
also try using cheaper models like Sonnet 4.7 versus using Opus all the time,
especially for less complex features. And of course, you can always keep
on building with API-based building, which is the default if you're
using Claude in an enterprise. Mistake number three is that files
not tracked by Git don't get carried over when you create worktrees. These are things like your .env
file or your .env.local files. To get around this, we add
a .worktreeinclude file to your project root directory. This includes the names of the files
that you want automatically copied when new worktrees are created. This ensures that your local
environment variables get carried over to new worktrees that you create. The fourth thing to be aware of
is that certain types of projects are better suited for use with
git worktrees than others. For example, worktrees work great
with web backend or full stack apps. For example, Next.js apps work
very well with worktrees, and they make it easy to run and test
apps running in worktree branches. But worktrees can be tricky
when building, for example, with iOS apps or native Mac apps. The reason is that iOS and Mac apps have
things like unique bundle identifiers, which identifies the app that's running
on your machine or on the simulator. So even if you have separate work
trees for your application code, you'll still run into stuff like
this when you build your project and test it to see your changes. To get around this, you'll need to
ask Claude to create something like a per-worktree bundle ID and a per-worktree
app display name so that you can preview and test your changes independently. Now there are also a few other Xcode
specific gotchas in addition to the bundle ID example that I just showed you. So just keep those in mind and ask
Claude about them if you're using Worktrees to build iOS or Mac apps. And fifth and finally, don't
keep old worktrees lying around. Make sure to clean them up. Worktrees can accumulate dependencies
and in general just take up space. Remember, they're copies of your
project, so they take up storage and they take up space on your machine. I use a custom skill called
/cleanupworktrees in order to do this, but you can just ask Claude to remove the
worktrees that you no longer are using. Now parallel agents is just one of many
ways in Claude Code to have multiple agents working for you, and it's
important to understand how this works and how it compares to other methods. In general, there are three
popular ways to build with multiple agents in Claude Code. We've just seen a system to build
with multiple Claude Codes with git worktrees, but there's also
things like parallel subagents and a new feature called agent teams. So let's take a look at what
these are, how they're different, and when to use which approach. Now let's compare multiple Claude
Code agents with agent teams. Now, agent teams are multiple Claude
Code instances that work together. You have a team lead which
delegates tasks to teammates who can work together with each other. The key difference is in
isolation and in communication. Parallel agents with worktrees
don't know about each other. They work in isolation with no
communication between agents. In contrast, agent teams
have multi-way communication. You have a lead that assigns tasks and
synthesizes results, and teammates which can message both the lead and each other. There's multiple ways that they can
communicate and coordinate together. So when should you use, multiple agents
with git worktrees or agent teams? I think using multiple Claude Codes
with git worktrees is best for building multiple independent features in parallel. And I think you should use agent teams if
you're building one complex feature that requires coordination and that touches
many different components so that those agents can actually communicate and
coordinate when they're working on it. One thing to note is that agent
teams are experimental and Anthropic warns that they also use a lot of
tokens, so just keep that in mind. Otherwise, definitely give them a shot. Next up, let's look at parallel subagents
and how they compare to using multiple Claude codes with git worktrees. Now, subagents, in contrast to separate
Claude code instances, are child instances spawned from a parent agent,
and these child instances handle a focused task and just return results. So if you want to look at the differences,
we have one-way communication in the parallel subagents case where subagents
report back to the parent thread, and once again, no communication and isolation
in the case of multiple Claude codes. Now, you can have multiple
subagents working in parallel, but the key difference is that
subagents and parallel agents are different levels of abstraction. So let's take a look
at how that's the case. The key idea here is that agents can spawn
subagents to help perform a specific task. So you can have multiple subagents
spawned by a specific agent in order to perform a task in parallel. For example, performing web searches,
reading files, doing the same thing for different components. Maybe it's research,
maybe it's implementation. Now, the cool thing here is that you
can actually use parallel agents and subagents together, as you can see in
the diagram, For example, you can have multiple agents that are created, so in
this case, we've created three agents, and each of these agents in turn spawns
multiple subagents to help it complete the task that it's been assigned. So these features, parallel
subagents and, multiple Claude code agents are not mutually exclusive. You can use these things together,
but it's good to understand which one you're using and the
trade-offs that come with it. So once again, I'd recommend using
multiple Claude codes with git worktrees when you're building multiple
independent features in parallel and using parallel subagents for things like
research, investigation, and analysis where you just need the answers back. So this is just an overview, but let me
know in the comments if you want a deeper dive into more in-depth explanations of
how these multi-agent workflows, compare to each other and seeing things like agent
teams and parallel subagents in action. So that's it. That's the exact three-phase system
that I use to build with multiple Claude Code agents, and you now
have a complete system for building with multiple agents productively. If you want help applying the system,
check out my AI coding accelerator, Ship with Claude Code and Codex, where
you'll build repeatable AI coding workflows and get hands-on help from me. You can find the link with
a YouTube exclusive discount in the video description. Don't forget to like and subscribe
for more AI coding videos and leave a comment with what you learned or
with any questions that you have. I read every single one of them. Catch you in the next one.
