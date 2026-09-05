Today, I'll show you not only how to build,
but also how to deploy a full web application using Claude code. I'll walk through every step
as if you're a complete beginner. By the end of this video,
you can have a fully functioning application. This deployed on your own domain
that other people can actually access. Let's dive in. So to get started here, there's a few things
that we should download and install. Now. First of course is client code. In order to use Claude code
you do need a premium subscription. With Claude’s, you are going to have to pay for this,
just like really any of these AI tools, but you can download it
once you have that subscription by going to the website,
which I'll leave a link to down below. You can download the desktop application
or run this command, which is going to install the terminal application for you
that you want the terminal application. This is what we'll be using in this video, because
it's going to be better for the deployment process. And what I mean by that is that Claude has its own
desktop application. Right. So you can download Claude and open it. You could see I was brainstorming
some video ideas here. And you can switch over to this code tab
where you can start using it from this view. Now this is fine, but it's a lot easier to use
Claude code directly from the terminal where what you do is you open up a terminal like so
and you type the command Claude. This will then run Claude code for you
directly inside of the terminal. Now, I know a lot of you already have this downloaded, but if you don't,
what you're going to do is open up your terminal. Whether you're on Mac, Linux, or Windows,
and you're going to paste that command that you found from this website. So curl F XL, whatever, and then just run it. When you do that, it's going to download
and install Claude code for you. And then once that's finished you can invoke
Claude code by typing the command clod. When you do that
it's going to bring you inside of here. You'll likely need to authenticate to sign
into your account, and then you're good to go. Now, once you've got Claude code installed,
the next thing that you're going to want is download some type of code editor or ID
now I recommend cursor, but you can really use anything that you want
as long as there's a VS code fork. Because to deploy the project we're going to use a cool extension,
which we'll have a look at in a second. Anyways, for
now I'm just going to go to the cursor website. This is a place where you can write code
and you can view all of the files. This is free to download. You can simply press the button
and download it for windows, Mac or Linux. Again, I'll leave a link to it in the description
free. Just download it, install it
and then you are good to go. Now at this point, assume that you've installed
Claude code and you have some type of code editor for it. Now, in case you're wondering, once we build
the application, we're going to use a platform called hosting or to deploy it. There are a long term partner of mine,
but anyways we'll talk about that later. Okay. So for now, once we've got that all installed,
what we're going to do is just open up cursor on our computer.
So just find that application. I'm just going to search for it
in the spotlight search. And what we're going to do is just make a new folder
where we can put our application. So we're going to go file. We're going to go to open folder from cursor. We're going to go to our desktop
or any location that you can remember. And what I'm going to do is just make a new folder. And I'm going to call this my site code. Anything that you want. If you have an idea of what it is
that you want to build. Okay. So now what we've done is
we've opened up a new folder inside. Of course,
they really don't need to know too much about this. This is just a tool
that we're going to use to be able to view the different code that we're generating,
and it makes it a little bit easier for us to understand what's going on, to add an image
and to eventually deploy the site. Now we're going to use Claude code
directly inside of cursor. So there's no need to worry about this kind of agent tab
that's going to appear when you get into the editor. So we can just go ahead and close that. Now, this is what's called a fork of a popular editor
known as Visual Studio Code. So if you've ever used that before
this is effectively the exact same thing. It just has some AI features built in. You're going to see a ton of stuff here. Again, don't confuse yourself. Literally all you want to do is just look for this
little file menu on the left hand side. You can see that it kind of looks like two files. You should see that my site is open. And now when we start generating code, we're going
to see all of it appear on the left hand side. Here you can move windows around. You can reorganize it if you want. You can collapse the sidebar. But that's really all that you need to know okay. So from here what we're going to do is we're going
to look for this little extensions icon. It might have moved, it might go somewhere else. But we're looking for something called extensions
which looks like these kind of little puzzle pieces. You also might have to find it by expanding this
right here to see all of the different options. Now, what we're going to start by doing is installing
the clawed code extension inside of this editor. So you'll see we have Claude code. Mine's already installed. But all we're going to do is search for it
and then press install okay. And that should install Claude code for us. Now the next extension we're going to install
while we're here is the hosting or extension, which we're going to use later
to actually deploy our site. So you can go to Hostinger. Just search for it again
find this hosting or connector. And then just go ahead and press on install. We're going to trust the publisher
and then install that inside of our editor. That's it. We have the extensions. And now we can start building our app. So what we're going to do now is open up
Claude code inside of this editor. Remember
I told you that you could open it in the terminal. You also can open it directly inside of these editor
so you can view the files. So to do that you can press this little down arrow
and you can find this clod code icon. You'll see I have some icons here
you don't have because I have other extensions. So I'm just going to press on Claude code. And you'll notice that it's going to open for us
kind of a new session view right here. And we should see we have web. We have local. And we can press this button new session. Then when we press new session it's going to open a new Claude code
session for us hopefully in the big view. If you want to move it around, you can drag this
window and kind of change the size of it. And here we can start prompting Claude
to actually generate stuff for us. Now I'm also just going to go back to the file view. So we have the files on the left
hand side and Claude code on the right. Now you'll notice here that there's an option
that says prefer the terminal experience which is back in the settings. So if you've used Claude code before,
you know that you can use it from kind of this really terminal environment
where it's not very pretty. There's not like a graphical user interface. But right now we're inside of this clean
UI that it's created for us. So if you want to go back to the terminal,
you could press this button. Right. And we can change it so that we're launching it
in the terminal rather than in the native UI. Now, for most of you, especially if you're a beginner, I'd recommend
you just keep it in the default view. But if you want to change that,
you can directly from the settings here in cursor. Okay, so from here
just a few quick options to go over. You'll notice that there's a button down here
that says edit automatically ask for edits or plan mode. It also gives you the ability
to change the amount of effort that you want to use. The more effort
is, the longer it's going to take, and also more expensive it's going to be in terms
of the number of credits that you use. So what we're going to do is just leave it in edit automatically,
and we'll put the effort at medium rather than high. Now another thing we're going to want to look at
is this slash button right here. So if we go here there's a bunch of different options
for things that we can change. One thing that we'll want to do
is just switch the model. So you'll see where it says model.
We can switch the model. And I'll just leave it as the default here
if oops 4.7. But if you want it to be cheaper
if you don't have a Claude max plan for example, you can make it Sonet,
which is usually a lot more cost effective or even high Q
if you want it to be the cheapest possible. Anyways, we'll go with this opus 4.7
and use that for now. All right. So everything is set up now
and it's time to actually start building. Now when we're building with Claude code,
it's really important that we know what it is that we want to build. And then we come up with a little bit of a plan
or kind of a spec before we actually dive in and start
generating any code files. Now, my case, I'm just going to build
a really simple landing page, because I think that's
what a lot of you guys are building. Just simple websites, maybe something for a business
that you're running whatever. Right? But you want to have a clear outline of
what are the features that I want to have, what do I want the website generally to look like? Are there logos that I have? Is there a color theme that I want to use? Doing a little bit of planning on your own
beforehand is going to be really helpful,
and gives you a significantly better result. So what I recommend doing is kind of going
into Claude code and just dumping your thoughts to it, and telling it, hey, help me
come up with a plan, ask me some questions. Let's go through this
before we start generating some code. So I'll just do a bit of a made up example here
where I make a website about myself. So I'm going to say hi,
I want to make a portfolio website for myself Tim or Seka or Tech with Tim. I don't really know exactly what I want to be on the website,
but I want to put some of my prior work experience. I want to put some of my skills, characteristics,
and maybe reasons why I should get hired and maybe some different projects from my GitHub
I want to showcase on there as well. Now, can you ask me a bunch of questions
about the design, what the pages should look like, just any information
that you need to help me build this site. Let's get a clean kind of spec and plan going
before we start building anything, I'd like you to create a markdown file that's going to have
all of the information for the site. Before we start building again,
ask me any questions that you need. Okay, so what I did is I said, hey,
this is kind of what I want. Ask me some questions. Let's go back and forth and then notice I told it. Create a markdown file,
which is a specific type of file that I agents are really good at working with. That's going to have all of these details saved. So we have them inside of the project. Okay. Now what I did to do this, by the way,
is something called Whisper Flow. It's the best voice dictation tool out there. You can see that
I am an absolute power user with 111,000 words. It's free to use
and I have a long term partnership with them, so I'll leave a link to it in the description,
but it's just really good for being able to voice your thoughts
very quickly as opposed to typing. So I'm going to go ahead and press on. Enter here and we're going to get it to start
generating this plan. And I'll go through the questions
and kind of walk you through what I'm doing here
and all of the prompts that I'm writing. Okay. So while we're in this process, it may also
be asking us to approve some different commands. So I'm just going to go ahead and press on. Yes, of course you can look at what it wants to do, but sometimes it's
not really going to make sense to you. And in that case you can just approve it. It will go execute the commands, etc.. All right. So we can see that it's asking me some questions
here. It says
what do you want to attract clients. Personal brand. Let's go with personal brand for this one. What's the structure. Let's just go with a single long landing page. What esthetic do you want. Let's go with like, yeah, dark and modern. And then what tech stack we should use. And this is super important. If you're building a relatively simple website,
you're almost always going to want to go with Next.js and then tailwind.
So the stack that's recommending right here. And if it doesn't recommend a stack,
I would suggest telling it to directly use Next.js, because it's just going to be
one of the most scalable and easiest sites to actually deploy,
which we're going to get to later. Okay. So what I'm going to do is go with Next.js. But if you are trying to build like a desktop
application, you're building something much larger. You want it to be super performant. You may go with another stack, especially
if you're going to have a dedicated backend if you even know what that means. But in our case, we're just building something visual
right where it's just you're interacting with it. It's giving you information. You want to build something that has a lot of data
users accounts, like a social media platform. That's when it's going to get a little bit
more complex, and you're going to have a back end plus a front end, in which case Next.js
is still going to be a good option. But you're also going to have to connect to things like databases,
which you'd want to talk to quite a bit. So for now we're going to go Next.js. But just be aware that if you do want to store data,
which I don't really need to do for this site, this will change the decision a little bit,
and you should really discuss with the AI beforehand what decisions you need to make,
so it will support what you want to do with the site. And that's why it's so important that you know what
you want to build before you dive into this process. So I'm going to go here with Next.js
and I'm going to submit these answers. And now it should start generating that plan
which will then review before we start building. All right.
So now he knows the design that we want to use. But it's asking me a ton of questions
about what I actually want to put on the site. So I'm just going to fill these in
and then we'll go from there. Again. You'll need to do the same things. You actually know
the content is going to go on the site. All right. So what I did here is I just told it to go research
myself rather than be giving it all of the details. It was able to do that. And now it's generated
this spec MD file, which we should see in this file menu on the left hand side. So if we want
we can have a look at this scroll through. Make sure that we're happy
with obviously everything that it's given us. It's also laid out
kind of how it's going to develop this application. And notice that we have a lot of structure now. So when Claude code starts to actually write
the code, it can just follow the spec and let's say we were to stop and come back to it
another day. It can always just go back and look at the spec file,
which is why I always recommend starting like this. So now that we have that information, we can essentially just tell it
to proceed to build our website. And again, a lot of the hard work is kind of done
because the spec is already written, which is really where most of the hard work,
you know, happens. Right. And the reason why you'll get into a lot of issues
when you're building with AI is because you don't follow that planning.
Step up front. So now what we're going to do
is essentially just tell it to build the site. So I'm going to say, okay, the spec looks great. I want you to build up the full website right now. Keep it MVP. Don't make it too complicated. And then run the site so I can do it on my computer. That's it. That's all we're going to tell it. MVP means minimum viable product. I always like to tell it to build a slim version
first before we go and add, you know, a million features
because AI is better at discrete small tasks. So the less stuff you get it to do in one run,
the better results you're going to get, and then you just have to go kind of back and forth
and tell it, okay, add this feature okay. Add this feature as you're going to see in a second. So let's go ahead and press enter and get the result.
All right. Now it's asking me permission to run these commands. So I'm going to go ahead and press on. Yes. And just by the way
it may want to run a command for you that you don't yet have
or that you haven't installed on your machine. If that's the case and something's going wrong,
you can tell it, hey, give me the instructions on how to install this
or what do I need for this to work? And Claude code's pretty good at doing that,
so it should be able to do it by itself. But if it doesn't, don't freak out. Just ask the AI
and it can tell you exactly what to do. If you just read the response
let's go. Yes, and keep going. Nice. So it says then it's running the application. Now it just took maybe 5 or 6 minutes to build that. So I'm just going to press on this URL. And you'll notice that we get the app now. And it's open directly inside of cursor. If you don't want to open any cursor for some reason,
you could just open up Google Chrome and you can just paste the URL here. You can see it's localhost 3001, which just means
that it's running locally on your computer. Now I actually think this looks quite nice. You know, I started coding as a kid. Okay. All these stats are true languages. Yeah, that looks pretty good where I've worked. Yeah. Software engineer. I don't know about SAP.
I don't know what he's saying with that. Yeah. Not sure what that means. Microsoft is real. Some projects I've worked on. Here's some videos, 
your free code camp where I've been featured. Dev, launch a program I was running,
let's talk my email and then all of the stats. And again,
like this was built with just 2 or 3 prompts because I spent the time actually creating this spec
upfront. You can see 2026. We have all this stuff. And of course if I want to add it, refine it, etc.,
then I could tell it to do that and we would get, you know, a better site. But at this point, I mean, I'm kind of done. That's exactly what I wanted to build. And what I want to do
now is move on to actually deploy the site. So of course, go back and forth, iterate with it. But what we'll do now is will deploy it. But we're also just going to quickly use
something called git and GitHub to kind of store our progress, to make sure that if we make a change
or if we break something, we can roll back in the future. Now, if you're a beginner, you don't really need
to understand what it is that we're about to do. But by setting this up,
Claude will be able to automatically go back to previous kind of saves of your website
just by you giving it this one prompt. So this is the prompt. You're going to say,
this is great. What I would like you to do now is to create a git
repo and just save all of the work as a commit. And I would like you to continually keep creating commits any time we make a change
so I can roll back to something. If a mistake happens in the future, you don't need to say word for word like that,
but that's essentially what you're going to say. Hey, set up, get it should then install the tool
if you don't already have it on your computer, and you can see it's going to tell us to initialize a new git repo and run these commands
that you're probably not familiar with. Essentially, all git is is a version control software which, like I said, is going to kind of checkpoint
or save the work that you've done. So any time you make another change, if something goes wrong,
you can just go back to the previous change it. Everything is still stored. This is what software
engineers have been using for decades now. And you can also connect this to something called GitHub, which will allow you
to share this code with other people on the internet. But we're not going to do that right now. All right. So it says and set it up with git now. And it's saved everything. So we are all good. And now we're going to move to the deployment. Now like I mentioned we're going to be using hosting
or to deploy this application. Now you can do this for as low as just $4 per month,
which is extremely cheap for web hosting. And they're actually going to give you a free domain. And the benefit of this is that you can do it
directly from Claude code with really no setup whatsoever. So what we're going to need to do
is just create a new account on Hostinger and just purchase our hosting plan. Can use something else obviously if you want, but this is what I recommend
and what is very affordable and cheap to do. So you just go to this URL, I'll leave a link to it
in the description, go to View Plans and then go to Choose Plan.
And you can choose the Claude startup one or the business plan
depending on what it is that you're doing. But for most of you, you just need the cheap plan
here, which is 399 per month. So I'm going to go to choose Plan. And that's going to bring me to this page. Now from here what we need to do
is select the duration of our plan. If you select one greater than 12 months,
then you can use this coupon code tech with Tim. Because of my partnership with Hostinger. And it will give you an additional 10% off. As you can see here, we're then going to pick
the domain that we want to host this on. So I probably want like,
you know, Tim Rashica Xcom or something. I don't know if that's available,
but let's see. Okay. And you can see it's free actually. So that's I probably should have had that before. But anyways, let's get that domain. We just want a one year for now. Just select one year if you want two, three, etc. just pick what it is that you want
and then go ahead and press on. Continue. All right. Now as you go through this process,
you will need to register your details. This is required whenever you purchase a domain. There might be a few other things to fill in,
but it should be very straightforward. And then it will give you access to the web hosting,
which will then be able to plug directly into Claude code and have it handle
all of the deployment for us right now. From here, it may ask you to connect with GitHub
or to upload your files. Just go with upload files for now
because we're going to do this from the connector. But you also could connect this with a GitHub repo
if you already have. And I was going to prepare the server space okay. Now once you get to this page here
it's going to have prepared the server space. And it's going to ask you to upload a file. Now you need to upload something
just so we can proceed. Because this step forces you
to upload something effectively. But we can manage the deployment
from Claude code in just a second. So what you're going to need to do
is you're going to have to go and find your folder. So in my case, it was my site. And what I did
just because I'm on Mac is I compressed it. Now, if you're on windows
you can just compress this as well. You seven zip whatever you want to do. So you get a zip folder okay. Then we're just going to go ahead and press on. Continue. And what this is going to do now
is start deploying this site based on the, you know, files that we attached. So we attached this Next.js
kind of zip folder. Right. And we'll just go ahead and press on deploy. We don't need to change anything here. And it will start deploying this to our domain. Now this will give us a base deployment of the site
that we currently have. But where this gets more useful
is that if we change something now in Claude code, I'm going to show you in a second
we could just tell it to automatically deploy and it will push to hosting or for us,
so that we don't need to go through this process. Every single time. It just when we're setting it up,
then we can go back to Claude code. And with natural language, when we connect
the connector, we can see the domains, push it, etc. and just keep in mind
that you can actually host multiple different sites on the hosting
or deployed instance that you have here. There's a lot of other features that it gives you,
but I think for the one that we used, you can have like five different sites. All right. So it looks like the site was deployed.
Just took a minute here. And then if we go to our URL we can see that it appears at ten second.com or whatever URL
obviously you used. Now this is great. But what I want to do is close this now. So if you've closed that, you should be brought back
to the panel here for hosting. And this is how you can
manage your site in the future. So if you go to websites and you go to all websites
here, you should see the site that you deployed. You can have a look at it. For example, there's tools like you can see
the analytics and the files. You can also go to the dashboard. From here you can connect to database, manage your files, go to the deployments right
and manage the domain. Now from the domain side of things if you want
you can actually get an email here. If you go to the domain. So you get a domain overview, select
the one that you have, renew it, whatever. Go through all of the different details here and then you can create different sites
and whatnot from here if you wanted to. Okay, now this is cool. What we're going to do
is go over to this API section here, and we're going to generate an API token,
because this is now how we'll be able to do the deployment
directly from Claude code in the future. So again on the left hand side you're going to go here to generate token
for the token name I'll just give it a never expires. And I'm just going to call this Claude code
and then generate okay. And I'm going to copy this token.
Make sure you don't share it with anyone. And we're going to go back here
and we're going to find the Host Stinger extension now that we installed. So we can start managing all of this from our, kind of AI agent
rather than needing to go to the platform. So what we're going to do
is press on this little down arrow, and assuming that we install that hosting our extension,
we should see it appear right here. From here, we can just paste our API token
that we just generated. It also shows you how to get it
in case you didn't follow that step. And then just press on connect. Now it says that it's connected. So now that it's connected
we can literally just go to Claude code and say, hey, what websites and domains
do I have with Hostinger? Right. And then just press enter. And it should now be able to use this
and give us the results. All right. So I asked this, but for some reason
it wasn't able to find the MCP server. And I believe it's due to how Claude code is kind
of working directly inside of cursor. Now I'm just gonna quickly show you that if we go
and we go to the settings here of cursor. So let me just find settings and we search for MCP. So you'll see that if we find MCP
which should be over here, tools and MCP that there is a hostinger tool
that's automatically been added which is known as an MC server or model
context protocol. Don't worry too much about exactly what that means. The thing is, the MCP server is here. The issue is just that the Claude code
session itself, for some reason, isn't able to access that MCP server,
but cursor itself can. So for example,
if we were to open up a new agent window. So if we just go here to this toggle agent
and we said, hey, what websites and domains do I have? Hostinger then this will give us the response
because it has access to the MCP server here, but just not in Claude code,
which I'm going to show you to fix in one second. And I just had to switch over to agent mode because it was telling me, hey, can't call the tools,
but you can see we have Timber Seacom, right? We have all of this stuff available
and then we are good to go. And if I wanted to, I can just tell it, hey,
redeploy the site and it can do that from here. Now that's great. But of course
the point is we wanted to get this in Claude code. So I'm going to show you how we can add that. So if we go back to the API page here
that we were on in Hostinger. So you'll notice that there is a configuration here
that we can just copy to add this to Claude code. So it says hey add this config file, restart
Claude code, verify the connection. You're all set. So what I'm going to do is just go here
and I'm just going to paste it in and say add this configuration to my Claude code. And then for the token we're just going to replace
the token with the token that we had here. So let's just I'm going to regenerate this one
and then copy it okay. So I'm just going to paste
that token inside of there. Of course. Don't share that with anyone. I'll regenerate it after. And then it should be able
to add the MCP config for us. Again the connector should have done this, but I think just how Claude code is generating
sometimes it doesn't show up. So if it's not working for you,
you can do this to get it in Claude code. Otherwise you can use it
from the agent inside of Curser. I know it's a bit weird, but you have Claude code,
you have a cursor agent, so there's like a lot of different config
that you could do. I'm just showing you all of the options. Okay. So that worked. So now what I did is I just started a new Claude code
session here. And if you type MCP and you go to MCP servers you can see the hosting or MCP is now connected,
has available all of the different tools. And we can use it to deploy. Right. So I can say deploy my project. Now change the name of the site
rather than Tim Rashica to be Tim Tech. I don't know, something like that. Just so we can see if it's different
and then it can go. Now use these tools and deploy it okay. And we can see that is now redeployed again,
just doing it from natural language. This time I didn't have to do it from the dashboard. So I can just do it all from Claude code. And if I open it up, you can see it says Tim
Tech, right. And change the name up here to Tim Tech
rather than Tim or like we had before. So there you go guys. That is how you build and deploy a website
using Claude code, at least as of now. Until they change something in the software later. I hope you guys enjoyed the video. If you did, make sure leave a like. Subscribe to the channel
and I will see you in the next one.