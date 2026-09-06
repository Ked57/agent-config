Most people open up Claude code,
start chatting with it immediately, and only realize about 20%
of what it's actually capable of. So in this video, I'm going to give you a slightly
more advanced Claude code tutorial where I show you my real professional setup
and we go over things like creating skills, sub agents, connecting to MCP servers,
and just overall build a much deeper understanding of how Claude code works
so you can utilize it in your workflow better. Now one thing to note
is that what I show you here may not be what you need for your workflow,
but it will show you how to set it up so that you can customize Claude code,
because that's where it becomes extremely powerful. So with that said, let's get over to the computer
and let's start looking at some more advanced Claude code features so you can get much
more productivity and benefits from it. Okay, so I'm on the computer now
and we're going to dive in. Now, I'm sure at this point
that you probably already know how to run Claude If you don't and you've never seen Claude code
before, you don't understand the basics, then you'll definitely want to watch this video
first. I'll put it on screen and link it in the description,
which goes over everything you need to know in terms of installing it,
setting up all of the basic stuff. Whereas this is going to be more of an intermediate or advanced tutorial for those of you
that already know the simple stuff. Okay. Now, with that in mind,
let's pop into Claude code here. And the first thing I want to do is just have a look
at a few commands that you need to be aware of. Now, depending on the type of plan that you're using,
you likely do want to change the model that Claude is using
depending on what it is that you're doing. So you can run this slash model command. And this will allow you to switch
between the different models. Now I know a lot of you know that, but
especially if you're on the $20 per month plan, you definitely don't want to just be using Otps
by default because it's really overkill. It costs a ton of money, and you're going to get significantly more usage
if you switch to something like sonnet or even haiku. Sonnet is just a default model
that should work for most tasks. Opus for something more complicated and then haiku. When you want to do something simple or generate a bunch of data, or you want to do
like a long running task that you know you don't want to use all of your usage
up for with haiku or with opus, right? So just switch between these and make sure
that you are kind of aware of what model that you're using, because you can really quickly rip
through all of the credits here, even if you're on the max plan like I am. You can get, out of the usage,
you know, very, very quickly. Okay. Now continuing another command that I recently found out about,
which is super cool is the slash insights command. And when you run this slash insights command,
what it's going to do is generate a full report for you on how you use Claude code. Talk to you about mistakes that you're making, things
that you're doing well, where Claude code is working for you, where it's not working for you,
and generate a full web page with all of the results. If you haven't yet, definitely take a look at this
because it can be really insightful, hence insights. Once it finishes generating, I'll show you quickly
what mine looks like and then we'll move on. Okay, so you can see that it's generated
this report for me it's just in a local file. So in order to open
that you can just go into like a Chrome tab. Okay. This is just my reference file. Let's open this up
and you can see that it shows you everything here. I'm not going to go through my full usage here,
but generally speaking you can see that gives you a really detailed guide
with a ton of graphs and charts and messages and at a glance
what's working, what's not working, etc.. So have a look at that
and I guarantee you're going to learn something. Now a few other commands you want to know. First slash costs. So if you are running on some kind of API,
you can run this and it will tell you how much it's costing. In my case, it's free
because I'm just using the subscription. And then the context command
is also a really useful command. What this will do for you is show you all of the
things that are being used in your current context, and give you a sense of kind of what
percentage of them are from what different sources. Now, again, especially if you don't
want to run out of the usage, which is important, you should, check this,
especially in longer conversations. And you can see that
we've used 25,000 of our 1 million tokens. You can see the system prompt 6.9 system
tools, skills, messages, free space, all of this kind of stuff. And then it shows you
all of the MCP tools that are being loaded in here. And you'll notice that depending on what
MCP provider you're using or how you set up MCP, you may have a ton of tools here
that are being loaded in that you just don't need. So I would highly recommend disabling tools that you're not using in a session,
because that will save you a lot on the context. And also just make Lod code
be a little bit faster and easier to run, because it's not going to be searching through
a ton of tools that you just aren't actively using. Like in my case, I have all these Zapier tools
where like, I'm not actually using them right now and they're just bloating the context
and potentially confusing client code. Now, the last quick command to go over here
is slash compact. What this is going to do is clear the current history that you have to keep
a summary of that in the context. So if you're getting near the context window
or you just don't want it to be as expensive because the context window is quite large,
you can compact this again. What it will do is summarize the current conversation
and include a small amount of tokens. In this session so that you can keep going
with the same session without losing everything. Compact is not always the best strategy,
but it's just a command that you should be aware of. Okay, so those are a few basic commands. The next thing that I want to go over is adding
MCP servers. Now MCP servers
really make this significantly more useful. And there's a few different ways
that you can add MCP servers to Claude Cook. If you're directly inside of the terminal here,
you can run the slash MCP command, where you're able
to see all of the different servers that you have. You can see I have some enabled disabled, right. You know, automatically built in, etc.. And the one thing that you need to be aware of
is that when you add MCP servers, you can add them at a project level, at a user level
or at a global level. And that's kind of the same with everything
that I'm going to show you in this video. You can create something per a specific project,
or you can make it locally or globally for your entire Claude code instance. So just be aware of when you're adding these
and the scopes in which you're creating these different tools. Because if you want it to be global, for example, but you just add it in the project,
then you won't see it in other Claude code sessions. The way this works is
that Claude is automatically going to create a folder called .claude inside of the project
where you're working with Claude code. So let me get out of this here. Let's just type ls. Okay. I guess it's because we're in Claude It's not directly executing it,
but it should show us the current files that we have. And I don't know if we already have a Claude folder,
but if not, if we start making any changes,
it will automatically add it. Okay, so it looks like this folder is empty,
but if I just exit out of Claude code, let me just CD into one where I know
we're going to have a Claude code directory. So let's, let's, let's CD into maybe our dev projects ls CD into. And we'll go to the velocity one. And you'll see here
if I do list A just because it's a hidden folder. We have this dark Claude folder. And then if I CD into Darklord same thing like a,
you can see we have a settings dot local dot Json. We don't need to have a look at that file. But the point is that anything that's specific to a project
you're working in will go in this Darklord folder. So just be aware of that. Because if you add an MCC server for example,
by default it just adds it to the project. It doesn't add it to the global scope. You need to change that when you're
adding the server, which I'm going to show you here in a second. So let's CD back into our desktop
and CD into the demo that we have here. Let's run club and we are back to go here. Okay so as I mentioned
what we want to do is add a few MCC servers that the first extremely useful MCP
server to add is the GitHub MCC server. The reason you want that is because you want Claude
to automatically be able to create remote GitHub repositories
and push the code there for you. Yeah, sure, you can do it manually. It's not that much work, but generally having GitHub
MCP just makes your life a lot easier. So let me show you how we have that.
Then we'll look at the next one. Okay. So I'm going to leave a link
to this page in the description. But the easiest way to add the GitHub
MCC server is to run a terminal command. This is what the command looks like right here. Claude add or Claude MCP add Json GitHub. And then you put in all of this
and you replace your GitHub with your GitHub personal access token,
which I will show you how to get. Now we also can have a look here
and notice about the scope. So as I was mentioning it's
going to scope to local by default, which means it's only available to you
in the current project okay. Then you can scope it to a project
so it's available to everyone in the project versus MCP, Json. Or you can scope it to user
which is effectively global, where it means it's available across
all of the projects. For someone like GitHub, you probably want it
available across all of the projects. So you would add this dash
dash scope user to this command right here. Now the way that you can get the personal access
token, let's just open up a new window here so we can save that command to copy
later is the following. You're going to go to your GitHub account.
Obviously you need to have one. You're going to go to your where is it here settings. You're going to scroll down to your developer
settings. You're going to go to personal access tokens
fine grained token. And then you're just going to create a new token. So you go create new token authenticate specify
the scopes you want to tap access to. Typically it just needs access to the repo. And then it will give you that pattern. I'm not going to do this because I already have the MCP server added,
but I'm going to show you now what you would do. So now what you do is you essentially take that token
that you generated and replace it in this command. If you're unsure of how to do that,
just open up some kind of notepad. So I would just paste this command in your notepad. And then you take this and you say, you know,
this is the token and you just push paste the token there and then you run this command
directly in your terminal. So what I mean by that is you literally just open up
a new terminal, don't run it in Cluade code. So get out the Claude code first and you just directly
run it in the terminal, not inside of Claude code. And then same thing. You could add dash dash scope and then you can say
user and this one star like globally for you. So that's how you add the GitHub MC server. And then if you want to test
if the MCP server is working same thing. You can just restart Claude from here. You type MCP
and then you should see the GitHub is connected. And then you can go here
and you can view all this stuff. You can re authenticate reconnect whatever. And once you add the GitHub server because you're using the personal access token,
you shouldn't need to do any off thing. It should just be set up for you. Okay. So that is the first thing
that you want to install GitHub MCP. Now the next thing that I'm going to recommend
adding is the context seven MCP server. Now it's much easier to install this
if you just open up the Claude desktop application. Now this will sync with your Claude code. So you can have Claude code installed
and then download the Claude Desktop application. From here. Let's just go back to a new session. You're going to go to the code tab at the top. You're going to go to customize
and you're going to go to Personal plugins. Now from personal plugins
what you're going to do here is browse plugins. And you're going to search
for a plugin called context seven. Now I believe I already have it installed,
so it's not showing it to me. Let's see. Context seven yeah, it's
because I already have it installed. But essentially you're just going to install the
context seven plugin, which looks exactly like this. What this does is give your Claude code access
to live up to date documentation. It's free. You don't need to pay for it. And then there's a few other connectors or plugins
you can add. For example, one
that's pretty cool is called Super Powers. This is something that's going to give your Claude code,
just a better ability to create large applications. It does use a lot more context
and is a lot more expensive. So I would only recommend having this
if you have the Max plan. But essentially this comes with some pre-built agents
as well as some pre-built skills to do things like brainstorming for a new idea,
creating a mock up, reviewing the code. But again, it does slow down Claude code a lot,
which is why I have it disabled right now. And then the last plugin that I've installed
is called playwright. Again, these are just
you can find them by default in Claude code. It's just because I have them installed.
They're not showing up again. But you can search playwright
and it will appear same thing. You just install it and then automatically
these will be added to your Claude code. What playwright will allow
Claudecode to do is browser automation. So it can automatically test websites
that you create by itself, by running playwright scripts and spinning up a playwright
browser instance. I'm not going to get into how that works exactly,
but you can kind of get the idea there
in terms of why those connectors are powerful. Okay, so those are two connectors GitHub MCP
and then the context seven. And if you want to test
if they're working just say something like create a new git repo here
and then create a new remote git repository. And just push a Readme file
saying this is a demo application to GitHub. Okay. We're going to go ahead and press on enter
if my dictation will load. Of course it's being slow okay. So there it is. Let's go ahead and hit enter. And then it should have access to the GitHub
MCP tools here in order to do that. And it should be reading through the available tools. And then if we want we can change the mode here
to just auto accept edits by hitting shift tab on your keyboard. So if you hit shift tab, you'll see that you can change between Accept
edits, Plan mode, or just the default mode. So I'm just going to put accept edits on. So I don't need to keep accepting all of the edits
that it's making. And then it should be able to do this. Now it's saying the command G is not found.
That's fine. It should default to use the MCP server. Sometimes it can be a little bit stupid. So you just have to direct it. Hey use the GitHub MCP server
and then it should use that okay. So we can see here is now found okay I don't want to
use G I'm going to use the GitHub MCP server. And it says I want to create a new repository. So go ahead and press on. Yes. And then it should be able to call that tool
and complete that action okay. So it's saying this is live. So what I'm going to do
is just open this up in my browser okay. Let's go here and let's see. And we see we have the remote repo. I didn't have to touch this. Claude just did that for us automatically. Okay cool. So now we're connected to GitHub. Also, if you want to go even further,
you can give your Claude code its own GitHub account. Although in my case,
there's no need really to do that. And what we're going to do
is move on to talk about skills. All right. So I'm just getting Claude here
to generate a simple application in this directory so I can start showing you skills
and a little bit more of a practical demo. But effectively
what his skill is, is a learned behavior from Claude. So we just added MCP servers. Right. What MCP servers allow Claude to do is take additional actions
and it doesn't normally have access to. So we could connect it to notion. We could connect it to Google Drive. Right. Any place where we want. Claude. Claude, sorry to be able to take an action
from a developer setting. Usually, you know, a thing like GitHub makes a little bit more sense
now let me just go ahead and accept that. Now when we talk about skills,
skills are not really actions that Claude code is taking
or like a tool that it's calling. It's more so a behavior that it's learning how to do or that it's learned
how to do and it's documenting itself. All that is skill is, is really just a markdown file. And a markdown
file is just a fancy formatted text file that explains to Claude
kind of a step by step process that it should follow. So when people start talking about skills, really
all they're saying is, hey, we have this workflow
or this repeatable thing that we do a lot. So rather than just prompting Claude
and explaining to it over and over again to keep doing the same thing,
we can wrap that kind of workflow or repeatable task in a skill
which is effectively just a file. I'll show you exactly what it looks like in a second. And then when we want to do something in the future,
we can just reference that skill and Claude code will execute that. So that's literally all a skill is. And skills become useful when you actually use them
inside of a project to do something repeatable. So for example, if you're always, you know,
changing some line in a file whenever something updates,
maybe that's a skill you create for Claude. If you want to review the code in a certain way
where you're looking for maybe things that Claude doesn't do by default, you create a code review skill
and then you point to it. If you want a certain deployment step or Claude,
you know, runs. If you build commands
and then execute something for you, then that's a skill, right,
that you can give to Claude. So what I want to do right now is I want to show you
how to create your own custom skill. Exactly what the skill looks like,
and then how to use it and invoke it. All right. So before we do this skill, I want to show you the difference
between a prompt with and without the skill. So right now I have some code generated right. We're not really looking at it. But if I do maybe it
will give me a quick look at the project structure. And what I just asked you to do is create
like a simple API with express that just represents like a basic library with, you know, books, update
a book, delete a book, all of this kind of stuff. Now, running the command
directly inside of code is really not the best, because it's not giving me
the output that I want to see either. The point is, we have a bunch of files now, right? So what I could do is say something like, hey,
review the code and give me an analysis of it. Now, if I do this like that's fine. Obviously it's not very detailed prompt
what I'm asking it, but it should be able to review the code
and it will give me some kind of answer. The issue with this
is that if I want the code reviewed in a certain way, I'm going to have to write this
like really detailed prompt. I'm going to have to remember what the prompt is. I'm gonna have to do it again over and over again. And you can see that the way that it's reviewing
it is fine, but it's probably not the format that I'm looking for
or what I want to consistently get. So rather than trying to, you know, mess with Claude
every time and come up with the perfect prompt and save it in a notepad and,
you know, use it again, we just create a skill. So to create the skill,
we can literally just tell Claude to create one. Hey, create a new code review skill
and then we can tell it what we want the skill to be. Now the benefit here is that you can actually have
Claude code make these skills completely for you, and if you just give it enough detail on what you want,
then it will document the process and make the skill. Then you can run the skill and you can tell
Claude code to continually improve the skill until you get it to a place where you're happy
and then it doesn't need to touch it. So what I'm going to paste in here
is just an example of what a skill could look like. You don't need to write this from scratch. You can just have Claude code make it. So I'm just going to paste, what is it? This skill, I have one that I copied here. And let me just enter that in the middle. And this is kind of what it might look like. So name code review, description
structure code review following team standards. And then it says follow this structure security error
handling performance code quality testing for each finding
you know device severity location whatever. So this is the format that I want
the code review to be in. And you can see that right now what it's doing is it's looking at the documentation
on how to create a skill. And then it will make a new one for me. And it should just enter that into the skill file. Okay. So you can see what's happened here is it
says hey we're going to create a new file. The file is called skill.md. It sits inside of the code review folder
which is inside of the skills
directory inside of the darklord folder. So as I talked about before, you can have projects
and you can have global configuration by default. When you make a skill it's going to create it
in the project level, not in the global scope. So it's creating this Darklord folder
which is sitting in the local project repo. We then have a folder called skills. That's where all the skills go. And we have a skill called code Review. And skills empty. No skill not empty. It's just the format for where this skill should go. And then inside of this file,
if you had any scripts or other documentation, you can put them here and just understand
that Claude will read this skill.md file first. And then from the skills MD file you could reference
other things that are inside of this folder. So let's go ahead and press on. Yes. And just have a generate
this skill that I want to test it out okay. So we can see that it's been created here. And now if I want to use this skill
what Claude will do automatically when you put it in this type of format is create
a slash command that you can run. So I can actually run slash code
and then review it like so. And it's saying unknown skill. I might just need to restart the session here
for to pick it up, but that should have worked. So let's just restart this. So slash exit okay. And then let's just go to Claude
and then what we can do is say slash skills. If we say slash skills okay.
Now we can see code review. And then what I can do is directly invoke the skill
by doing slash code dash review. And there we go. It
now appears that it's had to restart the session. So now if I do the code review skill
I can also pass a prompt with the code review. So I can say slash code review
and then tell it something to review. Or in this case
just generally review the whole code base. And now you can see that it's giving it to me in the exact format
that we want, where it's showing us security. Right. And then we'll say wait a second. Shows us the error handling
and we get exactly what we were looking for because we bundled it in this personal custom skill. So you should be creating a lot of different skills. Make them on a project level,
make them at a global level. If there is a skill that you want to be
at the global level, you can simply just tell Claude code to put it there. So say, hey,
I want to move this skill to the global level. Okay, let's give it a second here. It's being very slow
because my internet is really bad. And then it should just be able to automatically
move it there for you. Okay. So you can see it's asking to move it to the global level which is inside of
just my home folder and then Auckland. Whereas this Claude folder
is just directly inside of my local directory. I'm just going to go no,
because I actually don't want to do that. But you get the idea. Okay, that's how you could move this skill
to the global workspace. Now there's a lot of other skills
you should be creating. Generally speaking, when you do something a lot,
wrap it into a skill. Ask Claude code to build the skill for you, review it, read it, make sure you understand it,
and then adjust it as needed. And you're going to get a lot better performance
out of Claude code. Now, it's also worth noting that
Claude can automatically invoke these skills for you. So while you can just run the command
to execute the skill, you don't need to, you can just say something that would involve
the skill being used, and Claude code will automatically figure out
that it needs to call that. So if I do say something like,
you know, review my code in the main files, I don't know,
it should understand, hey, I'm doing code review. Let me look at the skills I have. Oh, I have a skill review or code review skill. Okay. Let's use that
and then go and invoke that skill. And you can see it
does that right. It's doing the code review skill. And it's giving me the exact same format as before. And that's the consistency
that I'm talking about okay. So let's keep going here. I do also want to dive into sub agents and a lot of other more advanced features
like creating your own slash commands. But first I want to show you a visual way
to work with Claude code, because right now
we're directly inside of the terminal and it can be a little bit difficult to actually see and understand
what Claude code is doing, and just start digging into some of those files
that it's creating. Now, that's why I'm going to show you
this tool called Nimble List here. This is what it looks like. It kind of looks like a traditional editor,
but with a lot of other cool tools. And it's specifically designed to work
with both Claude Code and Codex. Now it is completely free. It is open source. You can download it right now
from the link in the description. They don't even have an ability to pay for it. And I did team up with them for this video
because it's a really cool app. I've been using, and I think you guys are going
to get a lot of value out of it now. I just opened another project inside of here,
but you can open up any project you want in Nimbus. You just go file, you know, open, and then you can
just pick a project that you want to open. And when you do that, what's going to happen
by default is you're going to have your Claude code session up here on the right hand
side of your screen. You also can just make a new one,
and then you get a new Claude code session, and you get connected automatically to the nimble MXGp server, which allows you to utilize
this really cool interface. So you can see, like on the left side,
you can see your Claude usage, you can see codecs. In this case we're not connected. You can see various extensions
which we'll talk about in a second. You can change the mode. So I'm just allowing all but you can change it so that you know it
asks, allows edits, all of that kind of stuff. You can change the color theme. And then if you have a look here, you can view a Kanban board,
which in my opinion is the coolest part of this that shows you what all of your different Claude code
sessions are doing at any given point. So you can see that
I have this little task right here. I can move it across to different portions. And if you're someone who's a Claude code power user
like I am, in a lot of cases, if you have multiple sessions open,
you can see them in all of the different status kind of lanes or whatever
you want to call it here, so you can understand what's actually going on and really quickly switch
between this view and all of the sessions. You have to know, like what's actually happening
with your Claude code sessions. Now, of course you can also view everything going on. So in this case
they have a really nice markdown viewer. So when you actually look at a markdown file you can read all of the formatted markdown,
not the raw text. And if you ask code to make a change, like let's say I don't know, review my project guide
and just make some small improvements, okay? If I ask it to do that,
we can actually view all of the diffs and changes that it's making to our files in real time,
which is super cool. So you can see that I'm working with Claude right,
using it on the right hand side of my screen. And then again if I want, if I go back here
and I view the Kanban, you can see we're now in the inbox
because I just sent the message and this is going to start getting moved
automatically into the correct column. So you can see it's now in the implementation column,
even though I didn't refresh or do anything. And we can see that
it's going to start actually making changes. And we can view changes
automatically right here in the browser and see or right here in the view or sorry and see the markdown
rerendering as well as all of the diffs. And we can approve them,
keep them whatnot directly from here. So you can actually see if I start
scrolling down here that it highlighted in red the thing that it's removing and highlighting green,
the thing that's added, I can go between the different changes directly in the file
to see any of the changes visually, and it's super cool that it works
just directly here with all of the rendered code. So it's a lot easier to read,
especially because markdown files are, you know, the common thing that you're working with
when you're working with something like Claude, a few other quick things to mention. They also have these custom extensions
that you can have. So what I actually have this do previously is
I just said, hey, build a custom extension so I can view all of the documentation for my project
in one clean interface. I just put that directly in the Claude window here. And then nimble is actually built its own extension. So now I have this like custom dashboard for my project where I can view
the whole project directory structure, all of the stuff that's going on with all of the tags
and whatnot directly inside of here. So it's kind of a little bit difficult to explain,
but it's like an extension on top of Claude code. That's specific to this project. The nimble is just built, and there's
a lot of other cool stuff you can do in this. But generally if you just want like a visual editor
for Claude code, you want to be able to view all the sessions and to be honest,
just the Kanban board alone makes it worth it to me. Because again, it's free. It's open source. You don't need to pay for it
and you can just visualize what's going on. You also can create different plans,
have decisions, track bugs, you know, create tasks, all kinds of advanced stuff. I'm just really scratching the surface. And then the last thing that I'll mention is
they also have a mobile phone app. So what you can do is you can actually monitor
all of your sessions and interact with Nimbus and your Claude code session
directly from your phone. If you just download the app again,
all free, all open source. That's the only reason I'm mentioning it to you guys. If you find it useful, download it, check it out. You can start opening your Claude code sessions. If not, then no need to use it. But I'm going to continue with this
for the rest of the video as I start talking to you about sub agents
and other more advanced features. Okay, so let's continue now and talk a little bit
about sub agents, as some agents get confused quite frequently because there's multiple ways
that you can use sub agents within the Claude code. Now a sub agent is effectively just another AI agent
that's running with its own context window
outside of your main Claude code session. So right now I'm in a session, right? I create a new session for Claude code. Now I could ask it to do something that's fine,
but I can also tell it to delegate a task to a sub agent or multiple sub agents. I'm going to show you
what that looks like in one second. Now, when I do that, what's going to happen is Claude
code will create multiple different versions of itself effectively
that have their own context and their own prompt or kind of tasks that they need to achieve
and just go out there and achieve them. So that's the first thing that we're referring to
when we talk about sub agents is these like multiple little agents
that you can spin up to break down a task. Right. But you can also create custom sub agents. And when you create a custom sub agent, you can give
it a set of instructions that it always follows. And you can reuse that agent multiple times. So again from your main Claude code terminal
you can tell it hey, go use my code review or agent. Go use my GitHub agent. Go use my deployment agent. And if that's already created and set up,
it already has a framework to work from. If you don't do that, Claude code creates
the agent by itself based on what it needs to do. So I know it's a little bit confusing,
but let's have a look at an example. So let's say I do something like I want you to audit
all of the documentation in this project and give me a concise summary
on exactly what it covers and where there's gaps. I want you to spin up as many documentation files
as there are sub agents. So each agent handles tracking one documentation
file, reports it back to you,
and then you take the summary and give it to me okay. So we're going to go ahead and press enter here. And then I want to launch the sub agent spin up
and kind of show you what this looks like. And then we'll create our own custom sub agent okay. So you can see what's happening is Claude
is automatically creating a few explore sub agents. Now these are sub agents that are actually or this is an ancient framework
I should say that's pre-built into Claude code. So Claude code has a few pre-built
sub agents that it can trigger. It can also make custom ones. And in this case we're using the explorer one. And you can see multiple of them are spun up. And then if you go to this little tab here
you can see there's a sub agent tab. Again you can see that this is zero out of five
just because these are now done running. And if you want to see what these sub agents
are doing well you can actually just go click into it and you can view the prompt
that Claude provided to the sub agent. And then what is it that they actually did
which is reading a Readme file, reading this, whatever going through.
And then there we go. We get the little message here. Let me just close this readme file
saying that this is finished. And if I scroll down, it gives me a full, complete
list of what exactly was done. So major gaps, recommendation, etc.. So this is cool. But again, where this gets more powerful
is when we make our own sub agent. Okay,
so now let's move on to create a custom sub agent. Now sub agents are going to live in this Claude
folder here under an agents directory. And they're going to look almost
the exact same as a skill. The only difference is
that it's going to be its own agent. Effectively they can call other skills. Again we'll dive into that in a second. Point is to make a new sub agent
we can go use the Claude code terminal. So I can say Claude and then I can type slash agents. Then what I can do is create a new agent like this. I can pick do I want to be personal? Do I want it to be projects? Okay. Then you can generate with Claude
where you just describe what you want the agent to be, or you can do manual, 
what do you call it? Invocation here. So it's going to say
give an identifier for the agent. Let's go. Test writer. Okay. Enter the system prompt for the agent. So I'm going to paste in the prompt that I have here,
which is going to look something like this. Now because we're going through
this kind of interactive flow, I don't need to provide the top section. So I'm just going to delete
that when my cursor gets up here. Okay. Cool. So let's get rid of all of that because it's already
going to know what it needs to do. And then we should just be able to select the model
that we want to use. And we're good to go. So it's going to say
when should Claude use this agent. When you are writing tests okay. And then you can choose. Do you want it to have access
to all of the tools? Okay. So maybe I don't want execution tools. All right.
So I'm going to hit enter on that and remove that. Do do I want all tools okay. Do I want only MCP tools. Right. You could choose what you want
the agent to be able to do. I'm going to press on continue. And then you can select the model. I'm going to go with sonnet. And for the color let's go with orange okay. That's asking for the memory for this agent. So again I can have no persistent memory. It can have memory in the user scope, local scope
or project scope. I'm going to go project scope. And then it shows me
what the agent is going to look like. I'm going to press enter. And then the agent is now created
and we can start using it okay. So to use the agent once it's created,
we effectively just need to tell Claude to do something that would utilize the agent. So if I say, hey, test the test writer agent, then it should just actually spin it up
and start using it. So there's not a command that I'm aware of to manually invoke the agent,
but Claude can invoke it by itself. So you can see now it's invoked test writer. The agent is going and executing and completing those different tasks
and whatever it is that Claude told it to do. So the main difference between agents and skills is
that agents are more flexible, they're general, and they're going to follow the system prompt
and kind of persona that you've given them, where it's a skill is typically a workflow
that an agent might use. So you might have a lot of different skills,
but only like 2 or 3 agents. And to be honest, you don't really need
to create your own custom sub agents, because if Claude needs one, it's usually better at
creating its own custom sub agent than you would be. And you can tell Claude to make the agent
and just save it persistently if you want. So I wouldn't
focus too much on making your own sub agents. I would just focus on instructing Claude
to invoke multiple sub agents when necessary so it paralyzes the tasks, right? Hey, you have six tasks. Go spin up six sub agents to do that. If you start telling Claude to do that, you're going to get a lot better results
than just trying to make your own custom agents. Now, just add a little bit more context here
in terms of how the sub agents work. You can see that there's actually
a whole detailed piece of documentation. I'll link it in the description
that goes over this from anthropic. But you should be aware
that when you're doing these sub agents, right. So when you're creating them,
they're going to inherit the tools from the main agent context
that they're created within. So what you can do is you can actually scope
specific tools to specific agents. So in this case you can see tools read
grab glob bash right. You can disallow certain tools,
which is a good use of sub agents when you only want them to do
something really specific. And then you can also have things like MC servers
directly for one agent. So if you have MC servers that you only want to use
in some context, or you don't want to confuse the agents with too many, then that's another good use
of when you would create a sub agent. There's a lot of cool stuff you could do. You can also scope particular skills,
for example. Right? You could specify the memory
that you want to use with persistent memory. Conditional rules. Hooks like you can get really, really advanced here. I'm not going to get into all of that in this video,
but I just wanted to show you that if you are going to go crazy with sub agents,
you should read something like this documentation or ask
Claude to ingest it for you and give you a summary so you can see you know
what's possible here in terms of the usage. What I showed you, just scratching the surface. I just want you to be aware again,
I rarely find myself creating sub agents, but you can manually if you need to
for something really specific like this. Okay. So moving on. The next concept that I want to cover is memory. Now first you need to understand. But in Claude code
there is no persistent memory by default. What that means is that if I go in one
Claude code session, I tell my name is Tim, and then I open a brand new session. Claude code will not know that my name is Tim. It's not going to remember that. So how do we get around this and understand
long term persistent memory in Claude code? Well, the first thing is just to remember that
it doesn't have memory by default, which means anything that you want to save
has to be written down and typically saved in some kind of markdown
or documentation file. Now there is a solution that Claude has built
into this, which is creating a Claude, MD file. Let me quickly show you, hey,
can you make a Claude or MD file and just save that? My name is Tim. Okay. So if I do this now
and I tell it to make the claude.md file, what it's going to do is in the local directory here,
it's going to create an all capital claude.md file. And it's going to save that. So you can see that Claude at MD right. Looks like this project owner name Tim. Now this condemned file will automatically be read in
at the beginning of any new session. So Claude will read any of the persistent data
that's inside of that file. Now you can have this at a project level. You can also have it, as always, at the global level. So you can make multiple Claude MD files. You can have a global one
and then you can have a local one. So now that I've done this, if I exit right
and I just open up a new Claude session. So what is my name. Right. Then we should see that it's able to find that this is Tim,
because it's going to pull from Claude, MD. Right. You can see there, which is,
the persistent long term memory. So anything that you always want to be loaded
or you want Claude to just know
you have to put in this Quad-Core MD file. This claude.md file exists inside of the Claude folder that I showed you previously. So you have Claude, and then you have that capital
claude.md markdown file there. And all is well, now that is cool. However, sometimes you want to store more, you want to have more memory
and you don't want it all in one single file. Now that's where creating an intelligent folder
structure comes in. And just something
I want to introduce you to the concept of. So you guys may have heard of open Claude before. If you've heard of Open Claude,
then you understand that this is an AI orchestration platform that effectively uses
LMS in the background to, you know, complete tasks. Right now, what they did
is they created this workspace directory. And then in the workspace
directory, they've created multiple different files that they've instructed
the LMS to read. Any time that they load. Now you can do this as well. And Claude and this one quickly showing it to you. And you notice that we have docs
right. Documentation. We have memory where we have all these
different memories that are automatically being here. We have different contracts that are being stored. We have skills that have been created. Right. We have various scripts that we're referencing. We have state. So as your Claude code
project gets a little bit more advanced, you can create a structure like this
where you don't just have one claude.md file, you have a whole directory of multiple markdown
files, skills, sub agents, whatever it may be, so that you can just get the most out of Claude code. So really, what I'm trying to show you here
is that the customization is unlimited. Your work
workflow will look completely different than mine, and you need to enhance Claude by adding the skills,
adding the sub agents, adding memory, creating persistent information
so that it knows what's happening. Now, by default, when you have these markdown
files, Claude will typically, if they're named accurately, go in
and read them to get additional context. If it doesn't, you can just directly reference them. So we'll go have a look at it. But that's going to add a lot of value
to your projects. So again you don't need to copy what I have here,
but I'm just showing you that if you want to create kind of that persistent memory for Claude,
you have to remember it doesn't have memory. You need to write it down
so that it will read from that. And then you can create a structure
that's more advanced in just one single file. And in that claude.md file,
you can even point to various other references so that Claude has a file tree
that it can go through. And this is how you build that memory architecture
and how it actually keeps track of what's going on and how if you open it
from another computer, you have another session. You don't lose all of that context information. So that's it guys,
that is going to wrap up today's video. I know there was a lot of stuff here a little bit
all over the place, but I wanted to show you a ton of different Claude code features
that you may not have seen before. I hope that you found this useful. If you did, make sure leave a like subscribe
and I will see you in the next one.