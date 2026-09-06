In the past few months, local models have gotten incredibly good
and relatively easy to run. So much so that you can
now use them for full local coding. That means you don't need
the internet connection, and you can do full a genetic coding
on your own computer without spending any money
or subscribing to any platform. Just by having the right model
and configuring your environment properly. So in this video, I'm going to give you
a tutorial on exactly how to do that. We're going to talk about model selection
how local models actually work, and more importantly, how you can configure them
and set them up to do a genetic coding. It's one thing to get a local model on
your computer is another to get it working inside of a coding environment so
that it can actually execute tasks right? Files, write code, do bash commands. You get the idea. So with all of that
said, let's get started. So I just want to spend 30s here
talking about how a local model works. And then we're going to get into model
selection, which is super important. So whenever you're doing a genetic coding, you're essentially
just using someone else's computer for your autocomplete or for your,
you know, agent tasks or code generation or whatever, that that other computer
that you're using is extremely powerful. Typically it has like a terabyte of Ram, a bunch of graphics cards,
and it can run really powerful models. Then you can just essentially call
that computer and get the response back. Now, when you're using a local model,
everything's on your own computer. So you're not calling out on the internet. You're going
you're not going to some kind of server and more importantly,
you're not paying for any compute. If I'm using cursor or I'm using cloud code, I'm using cursors model
and I'm paying their fees. If I'm using cloud code,
I'm using anthropic Spotlight. I'm paying their fees. If I'm using a local model, I'm just running it on my own machine
and it doesn't cost me anything. So I can run this, you know, an infinite amount of time
and there's no cost whatsoever. It's just going to be
using my own hardware. And that means that the type of model
you can run is fully dependent
on what type of hardware you have. And we're not yet capable of running,
you know, opus level models on our own computer. We can run ones that are pretty good,
that are close to maybe like a sonnet or a haiku. And depending on the type of computer
you have, obviously you're kind of mileage
and performance is get a very. So keep that in mind. If you're on a really old computer, this video is probably
not going to be that useful. But if you're on a newer computer,
if you have a high end graphics card, you're going to see that you can get
some really good performance to the point where you can actually just use this
fully all the time and only go to a high end model. If you really need something complex done. Okay, so with that said, let's talk about selecting the model
because that's super important. And then after we do the selection
we'll go into all of the setup. So in terms of selecting the model
the type or more importantly the size of the model that you can run is going to be dictated
by pretty much one number. And that's your video memory
or your video Ram. Okay. Otherwise known as v Ram. Now in order to find that number,
it really depends what operating system you on. So if you were on a windows computer,
you hopefully know the hardware that you're running. If not, you should be able to locate that
relatively quickly. I believe you can go to your task manager, and you should be able to see
what your graphics card is, and that graphics card
is going to have a certain amount of Vram. So if you're running an in video GPU,
for example, maybe running a 49 year, 5090 or 30, 60 TI or whatever
the value is, just figure out what the Vram is,
the amount of video memory. For most modern graphics cards, you're
going to be looking at eight gigabytes, 12GB, 16GB,
sometimes 24GB, depending on the model. And of course, you know how expensive
it was and what you paid for. Now that number is effectively
going to dictate the maximum size of model
that you can run on your computer. I'll talk more about that later. But if you have a 16GB of Ram graphics
card, you can effectively run a model that's up to 16GB in size,
should be a little bit smaller. But about that size. If we talk about MCC,
things change a little bit because on Mac, especially the newer Macs, any M-series Mac,
you have something called unified memory. Now what that means
is that you Ram on your computer. So in my case,
I have an M5 Max with 64GB of Ram is actually shared
between the CPU and the GPU. So I have 64GB of Ram, just normal
unified memory on my Mac computer. And that technically means
that my GPU could use up to 64GB of video memory
or of this unified memory. So if you're on windows, you're looking specifically at your graphics card
and how much Vram is there? If you're on Mac, you're looking
at how much unified memory you have. And if you want to find this on Mac,
it's really easy. You can go to the Apple icon, you can go to about this
Mac and just look for memory here. And you can see that I have 64 gigs. Now this is only going to be applicable
on the M-series Mac. If you're running an Intel Mac,
then you're going to want to look at how much Vram is on the integrated
graphics card that's on your computer. But if you're on an Intel Mac, then
this video is probably not going to work that very well for you, and you're
only going to able to run really kind of. Local models because those are just
very old machines at this point. Now, one thing to be aware of
is that while you have unified memory and it technically all could be used
by the what you call a GPU. In theory, it's not all accessible. There's some memory that's required to run
the operating system, other processes that you have. So while you might have 64GB of Ram,
like me, maybe only 55GB of that
can actually be used to run the model. So essentially just figure out, okay,
how much memory do I have, how much Vram do I have on windows and
how much unified memory do I have on Mac. And then we're going to subtract
about 10 to 15% of that. And that's about the maximum size model that will be able to run
with decent performance. Okay. You could actually see I made a slide
for this. And effectively on Mac. Yes 75 to 80% of unified
memory is probably usable. And if you are on windows
you can use effectively all of it because you have all of that Ram
specifically for the GPU. It's not shared like it is on a mac. Now, one thing to note is that
if you are running on a windows computer, your memory throughput is going to be
a lot faster than on a mac computer. So, for example,
if we look at an RTX 4090, we have 1008GB per second
in terms of the speed of the memory. If we're looking at M4 Macs,
we have 546GB per second. Don't worry too much about this, but this is effectively the speed at which
the memory can read and write data. So while you might be able to load
a bigger model on Mac, having a dedicated GPU,
especially a high end GPU, usually you're going to get more tokens
per second or a faster response from the model
because it's just faster. Okay, so there's a difference
between speed and kind of capability. And just because a model is bigger
doesn't necessarily mean it's better. And same thing just because it's smaller
doesn't mean it's worse. The speed also is factored in
based on the hardware that you're using. So with Mac
you can have bigger models generally. But if you have a dedicated GPU, while the models you can load
are typically a little bit smaller, they're going to be a lot faster because
the memory bandwidth is typically quicker. Okay, so let's keep going. And let's just quickly go through
kind of a cheat sheet of what the size model you'll be able to run
based on the computer that you're on. The models have a number of parameters. And you're going to see this advertised. When you start looking at them
you'll see 7 billion, 14 billion, 32
billion, 70 billion, 480 billion. And the number of parameters
will dictate the size of the model. So typically speaking,
if you have eight gigabytes of Vram, you can run a 7 billion parameter model. If you have 12 to 16 gigs, you should be able to run a 14
billion won. If you have 24 gigs, you should be able to run a 32 billion won.
And if you have 64 gigs or more, you should be able to run
a 70 billion model. And this is not always the case. And we're going to look at this later. But this is kind of a general guideline
for the size of the model that you can run. And some models will be smaller or larger
with the same number of parameters based on kind of how they're tuned,
the quantity ization, which we'll look at later. I'm just trying to give you a high level
understanding, because the model selection is by far
the most important part. Okay. Now let's just quickly have a look at what model you should be running
based on the hardware tier that you have. Now, if you want to look for models
you can go to hugging face. Hugging face has a ton of different models
that you can scroll through here. You can filter
and you can find all different types of models
that you can run on your machine. But these are the ones that I'm going
to recommend if you follow along with. This is just going to be super easy because I've tested a lot of these
different models. Now usually we're going to use two models
when we're setting up, kind of local development. We're going to have one really small,
really fast model, which we use for auto complete if we're actually going to be typing and,
you know, getting autocomplete from code. And then we're going to use one
much larger, more capable model, which is what's going to be used for
chatting, editing, agent mode, whatever. So you're going to have
two different models. For most of us,
we're just going to be using this Gwen 2.5 coder with 1.5 billion parameters
for our auto complete model. Pretty much any computer that you have is going to be capable
of running this model. Even if you don't have a graphics card. But if you don't have graphics card, it's
going to be fairly slow. So anyways, for autocomplete, that's
pretty much just what we're going to use. And then for our chat and edit model,
this is really going to depend on the amount of Vram that you have. That is a family of models
that are very good for running locally
and doing a genetic coding. And it's the Gwenn family of models. So you'll see. Gwen 2.5. Gwen 3.6. Gwen 3.5 Gwen coder. Next. Okay, so there's a bunch of different
models with different sizes. We'll look at them here in a second, but for example, if you're running on a 16
gigabyte unified memory laptop with Apple or eight gigabytes of Ram, 
for a normal PC, you should be able to run this Gwen
2.5 coder with 7 billion parameters. Not a ton of parameters. Is going to take up
a few gigabytes of space. Should be possible to run and run
with decent performance. Next, if we go up in performance here,
we have 24 to 32GB of Ram on Apple
or 12 to 16 on a dedicated GPU. We should be able to run this 14 billion
parameter model or this 30 billion parameter
Gwen three coder model. Okay, so again, I'm just putting a cheat
sheet here so you guys can see them later. If we have more than 24GB of Ram
or on a really high end machine like I am, you should be able to run this
Gwen three coder model. If we keep going, you should be able
to run the Gwen three coder next model. If you have 64GB or more of memory,
and then if you don't have any GPU at all, you're going to use the same model
that you use for auto complete as your main completion
model, which is Gwen 2.5 coder with 1.5 to 3 billion parameters. Again, we'll look at this in a minute. I'll go into it in more detail, but
I'm just giving you a quick cheat sheet. And I made even a larger table here
with exact models in terms of GPUs and max, specs,
just a few of them that are pretty common. So you can see
which model I would recommend. Okay, so have a quick look at this. See if any of this applies to you. And now
we're going to get into the actual set up. We'll look at a few models specifically. And this will start to make
a little bit more sense. And one last thing to be aware of
while you can run any of these models on your computer,
assuming you have enough hard drive space, they're really only going to be efficient
to run if they fit into the amount of Ram that you have. So this is why I focus
so much on the Vram. If a model is ten gigabytes
but you only have eight gigabytes of Ram, the model can still be loaded
and it can still run on your computer. But the overflowing amounts
like you have eight gigabytes in Vram, the other two gigabytes is going to go
in your normal system memory, or maybe even on the disk, depending
on kind of how things are loaded, which is going to make it like 100 times slower than if it was fully
loaded in your video memory. So pretty much just only run models
that are smaller than the amount of Ram that you have. If you want them to run
in any reasonable amount of time. Again, you can always run these models, but they can just be extremely slow
if you can't load them in your free Ram. Okay, so we're going to keep going
and get into the setup. But one thing I want to make you aware of
is that this presentation is available from the link in the description, in case
you want to check it out for yourself. And you'll notice that I actually have
it deployed to this here Dawn now domain now here Not now is actually a long term
partner of the channel. They are completely free to use,
and there are a way that you can deploy sites really easily, especially for demo purposes, by literally
just copying one single prompt. Let me show you what I mean. If you just go to Here.now,
I'll leave a link to it. In the description,
you can copy their agent instructions. And this is actually exactly what I did
when I was building this presentation. Using cloud code. You can just paste the instructions here and say, hey,
I want you to set up Here.now and I want you to deploy this site and you
literally just paste it inside of here. I already did this
so you can see it does it, and it will just deploy this to a website
for you automatically. So you see it deployed to this site
that was loading. Right. You guys can now view it. And then if you want to claim the site
and have it be available for more than 24 hours,
you just need to create a free account and sign in just so you can save the site
to a particular account. You can see if I go to my dashboard here, I have a bunch of sites
that have already been deployed. This is completely free. You don't need to pay for anything.
You actually don't even need to make an account
unless you want to claim the site. And then of course,
if you do want to upgrade, you can pay $4 per month, $20 a month
if you want more sites, a bunch of storage. But I haven't had to do that yet
and I use this a ton. Anyways, massive shoutout to here Here.now for sponsoring this video
and providing this service because I use it all the time
and I genuinely think it is great. And with that said, let's
go to the next part of the video. Okay, so now that we have kind of a basis in understanding,
we can start actually setting this up. Those two pieces of software
we're going to use in this video. The first is LM studio. The second is Visual Studio Code. So download both of these
if you want to follow along. Exactly. You can use other code editors as well. But VSCode recently added a feature
that makes it really easy to run these local models. So I'm going to suggest
that you go with that. And it's just kind of the best experience
for local model development. Trust me, I have tried a lot. Okay, so download Visual Studio Code,
download LM studio again both these free. You don't need to pay for anything. And then what we're going to do
is we're going to open LM studio, and I'm just going to walk you through
kind of the basic user interface here. Now LM studio allows you to download
and manage with some more precision than something like a llama. Local models. Now what you can do is you can go to
the chat, which is kind of in the top left hand corner. Here you can go to the developer view,
which allows you to run a server, which we're going to look at in a second. And you can go to the model view, which is
what we're going to want to go on here, where we can search for models
and we can see our current LLF. So you can see I have some downloaded. And then we're going to want to do
is go to sorry. Actually this last button here,
we're kind of the robot button where we can start searching for the
LM that we want to download and use. Now, if you're unsure
which one to use, feel free to ask Cloud Code
look at my presentation or just copy. Exactly what I use in this video. Again, really depends on the amount of Ram
that you have. So in my situation,
I have 64GB of Ram on this computer. I'm using it M5 Max very high end machine,
which means I can run some pretty powerful models. Now, the models that I'm going to be running in
this video are going to be the Gwen 3.6 35 billion parameter model
and the Gwen three coder next model. Now I'm going to talk to you
about how I decided to pick these. And then I'll go through
a few smaller ones that you can use, because I know a lot of you don't
have the same level of hardware that I do. So the reason that I decided
to pick these models is, first of all, they're capabilities. Now, when you're looking at models, you want to make sure
that they have the ability to do tool use. Okay. So this is going to be for your main
chat model okay. The auto complete one is basic
for the main chat and edit model. It needs to have tool use. If it doesn't have to use, it's not going to be able to actually
call the tools to create the files. It's just going to be able
to give you a chat response. So yeah, I can tell you,
you know what the code is, but it can't actually edit it, modify it,
which is what makes these useful. So first of all, you need to use, right? Okay. Now for this one here. The reason I picked
it is because it's 22GB. So I know for sure I can load it
in my Vram because I have 64GB of Ram. And I'm using this Q four version,
which is what's called quantization. Now effectively when you pick these models
you can have the entire model okay. Which is all of the parameters,
nothing short and nothing fine tuned, whatever,
which is going to be quite large. And in this case it's 37GB for the 35 parameter, billion
for the 35 billion parameter model, we have Q six, which is just a smaller,
more condensed version of this. And then we have Q4,
which is an even smaller version of this. You have different levels
of what's called quantization. Effectively,
you lose a tiny bit of performance, but it shrinks the size of the model
drastically. So it's almost always best to just go
with kind of the lowest quantization version of the model that you're capable
of running on your machine. And this is also going to make the model
a lot faster. The smaller the model is,
the faster it's going to run. So I decided to go with this one. So my okay 35 billion parameters.
That's a lot. It's still super capable. It has tool use. It's going to easily fit in my memory
and it's going to run relatively quickly. Rather than me trying to run
a super powerful, really big model. There's going to be a lot slower. And I'll show this to you in a second. Okay, so that's one model.
That's a great choice. Another one is the Gwen three coder. Next. Now this is a much larger model. I'm going to show it to you in a seconds. About 44GB on my computer. But the reason I picked it again
is because it has tool use and because this is kind of one of these state of the art local models
that you can be running. And fortunately,
it just fits on my machine. I tested both Gwen three coder next, and this 35 billion parameter
Gwen 3.6 on my machine. Both work really well. This one is just quite a bit slower,
so typically I prefer to use this. Gwen 3.6 okay. And that's for me. Right? Because I'm running a pretty high
end machine for most of you. You're probably going to want to look at
the Gwen 3.6 14 billion parameter model. Okay. So you can scroll through here. You'll see that there's this 14
billion parameter model with this 83B. What A3 b stands for
is active 3 billion parameters. Don't worry too much about that. But effectively it means that what's actually going to be running on
your graphics card is a smaller number of parameters
than the full size of the model, which allows you to run
larger models, on worse hardware. So if you see these A3, b, a6, b, A9 b, whatever, that's
saying the number of active parameters. And that means the model's typically going to see more performance on your machine,
even if it's a little bit larger. So if you look through the options here,
you can see that there's a Q4, a Q3, a Q2. So depending on, again, the amount of Vram
that you have, pick the quantization and try to pick something that is maybe
like 5,060% of the Vram that you have. So it runs pretty quickly. So for most of you, if you have 16GB of
Ram you should be able to run this model. No problem on your machine. There's a few other ones,
like there's a deep SK model that's capable of being ran. You can see this one is pretty small. We're looking at like, what do you call it, 4 or 6, whatever
gigabytes with 8 billion parameters. So have a look, do some research, see
which one you want to try to run. The Java four models are also pretty good. They're very new
but they're not as good at coding. And then again,
the Gwenn ones are the ones that I would probably recommend to pick. I know I'm rambling a lot, but I'm trying to give you as much
info as I can because this model selection
is really going to dictate the performance,
and you're probably going to want to play around with a few of them
and see the best results that you get. Okay, so that is for just downloading
your main kind of chat model. Once you find the one you want,
download it, wait for it to download, and then make sure that we get our auto
complete model, the one we're all probably going to want
here is the Gwen coder. Next 2.5 with 1.5 billion parameters. I'm typing it incorrectly,
but if we scroll through here, we should be able to find it. Okay, let me just find it from here.
What is it called? It is. Let's see my alums. Let's make this a little bit larger. Okay? Gwen 2.5 coder 1.5 billion. Instruct. I just downloaded
the largest version of X. I have a really high end machine,
but you can download the smaller version, which is 900MB. Okay,
so these are the models that we want. Now, once we have these models,
if we just want to test them and make sure they're working,
we can just go to the chat window here. We can select the model
from the top of the screen so we can go, you know Gwen 3.6. And we can adjust a bunch of settings
for this model. Now what we're going to want to do is just make sure that our GPU offload
is as high as possible. We're going to set the context length. So the more that you set this so you can
see it goes up to 262,000 tokens here. Obviously, the more room it's going to take up on your computer because
this also needs to be loaded in memory. And you can see at the top
that it shows you the amount of memory that's going to be used here
as you scroll through and set the context so you can check versus your Vram
to see what you should set this at. There's a bunch of other settings
that you don't really need to go through. You just want to make sure
GPU offload is as high as possible. So it uses the full GPU
and then you set the context length. Then you can load this model. It's going to take a second to load.
You can see that at the top. And then you can start chatting with it
just to make sure it's working. And you should see that
you start getting tokens. Output it. Now you can see for me,
I was getting 100 tokens per second. That's quite fast, and you're not going to feel like
it's a slow model if you're running more than like 5060
tokens per second. But you can again play with it
and see what speed you're getting. Let's quickly
change over to the Gwen three coder next. And you're going to see that in some situations it's going to tell you,
hey like you cannot load this model. It's going to take up
too much room on your computer. I found that this is pretty aggressive
and that most of the times the model will actually load. So if it's giving you this issue,
don't worry about that too much. Feel free just to crank up the context. I'm going to go here and just press load
anyways and just wait and see if it loads. If it loads, you should be good to go. Then you can go ahead and use it and see the performance
that you're actually getting. Keep in mind that if you're on Mac, if you have a lot of other things
open, you're probably going to want to close those
when you're doing this so that your memories freed up
so that you can do this. So now we've switch the model. Let me just go. Hello. And now you can see we're using Gwen
three coder next. I believe this should work. And let's see if we get a response. Okay. Now, it did give me a response here, but this one took 25 seconds,
even though we had 82 tokens per second. So sometimes on Mac,
if your other processes are using the memory, you're going to have a delay. And it's kind of fighting for the space, I believe, because on screen recording
right now, I'm just at that limit where I'm not able to,
you know, run this efficiently. So for this video, I'll just use the Gwen,
what is it, 3.6 35 billion parameter model,
but you guys get the idea. Okay, so just test them,
make sure they work, and then what we're going to do
is go over here to this developer section. Now from this developer section,
what we need to do I'm just going to eject this for right now
is we need to pre load the models that we actually want to use
when we're coding. We're going to need to do this
every time that we're setting up coding. And we're going to need to start
this development server. Now starting this development server
is going to expose these models to our local machine, which means VS code
will be able to use them. And then we can see all of the logs
and everything that's going on in here. So I'm just going to turn on the server. And then we're going to go to load model. And we're going to load our auto
complete model. And we're going to load the chat model
that we're using. So I'm going to use Gwen 3.6 right.
Like I said. So I'm going to load that up here. You can change the settings again
make sure GPU off load is as high as possible,
and then adjust the context based on how much memory you have here. And you're going to have to play
with these settings a little bit
to see what works best for you. So that's loading. While it's loading we're going to load
the auto complete model as well. Same thing
I'll just set the context really large, even though we probably don't need
that much. Let's set the GPU off load
and then just load this up. And then both of these are now ready okay. So both of these models are now loaded
meaning they'll be accessible
when we start using them from VS code. And the next step
is to set this up in VS code. So in order to set this up in VS code, first of all
make sure you have the newest version. If you have the newest version of VS code,
they have a feature that allows you without signing in or being connected
to the internet to manage local models. So first thing I did here is
I just went to File open folder. I just opened a new folder on my desktop. So you just make a new folder and open it just so you're inside
of some kind of project. And then what you're going to do is open
what's called the command palette. So you're going to hit Ctrl shift
and then P on your keyboard or command shift P if you're on Mac this is going to open
what's called the command palette. From here you're going to type manage
and you're going to look for manage. It's like models or something. Yeah. Manage language models okay. This is the new feature that they've added
like a week ago or something. Now from here what we can do
is simply press on add models. We press on add models. We're going to go custom endpoint. And from custom endpoint
we're just going to give this a name. So the name you can just call this
LM studio I already have one called Home Studio. So I'm just going to call it
LM studio two. It doesn't really matter. This is just
what's going to show up in the list. So we're going to 
press that for the API key. Just put any random values
in. You just need something. So just put random string and hit enter. And then we're going to go with chat
completions okay. So select chat completions. And then what you're going to see is that
it opens up this config file for you. Now in this config file what we need to do is just fill in three values here
the id name and URL. It's super basic. What we're going to do is we're going to
copy this URL right here. It'll be the same that I'm typing in. So you can just copy it from what
you see me typing. But it's also available here in LM studio. And this is the URL to the LM studio. What do you call it? API okay. So we're going to paste that URL. And then for the ID we're going to select
the ID of the model that we want to use. Now the ID is available
right here in LM studio. So you can just press this copy button
and it will directly copy it for you and just paste that ID. And then for the name
you just put the exact same thing okay. Now you'll see that for the capabilities
it shows tool calling. And then vision. You only want to select vision
if vision is a capability of the model. For Gwen 3.6 it is. So we'll just leave vision as true. And then you can adjust the max input
and output tokens. So in my case
I believe we can see the context of this. Yeah it's this. So I'm just going to copy this number here
and adjust the max input tokens. And then for the output tokens
you can set up whatever you want. I'm going to crank this up to 64,000 okay. So what this is now
done is it's simply added a model. And if we want to test if this is working, let me just delete my other settings here
so that we don't mess anything up. We can just save by hitting control S
on the keyboard and then exit out of this. And in order to see if this is working,
what we'll do again is go control
go command shift P or control shift P. So open up the command palette again. Same thing manage language models. And we're just going to see
if this model's appearing. And you can see that it is
this is Gwen Gwen 3.6 35 BA3B. Now if we want to adjust this we can press this button right here
which is opening the language models Json. So it's going to bring us right back here. And then we can add another model as well. So I'm just going to add my next model. The way I can do that is just copy this
and put it inside of LM studio here. So notice
there is this kind of models array. For this next one
I'm just going to say vision is false okay. And for the max input tokens
we're going to adjust this. It's going to be a lot smaller. We're just going to go like 32,000. And then for the ID name in the URL
we can put the autocomplete model. So I'm just going to copy this okay. And just change the model here
for our autocomplete okay. Cool. Go ahead. And now we've added that and we have this
other model added as well. Although for the autocomplete
we're gonna have to do something a little bit different
which I'll show you in a second. But this so you can add multiple models
in case you want to switch between them. So now that we have this,
what we want to do is we want to open the chat
window in VS code. So to get to chat I believe
you can toggle it from the top somehow. Or you can hit
control L or command L on your keyboard. I just want to go into this chat window. Should be open by default
I believe you can also go view appearance. You should be able to find chat somewhere. I don't know exactly how you open it. Usually in VS code. Here you go. Chat in this setting it should open it up that just on open it
of course because it was already open. But from chat we can make a new chat and then we should be able
to select our model. So if we go to select model
and we go to other models, we should see the models we've added. So we have this Gwen 3.6 model. And then we can say something like hey can you make me a game of chess
using JavaScript and react? Okay, go ahead and press enter. By the way, you guys always ask me
what I'm using to dictate here. It's a really cool tool called
Whisper Flow. I'm an absolute power user of the tool. You can see I have over 133,000 words. It's free to use.
It's the best AI voice dictation. It works
right inside of these code editors. You can also directly tag files and
have a long term partnership with them. So if you guys want to download it
and support me, I have a link below
that you can use again, totally free. And then you can upgrade if you want to get more limits,
whatever all the features that they have. Okay, cool.
So you can see this is not working right. It's functioning. It's actually using the model,
although it seems to be a little bit slow. And if I go here, you can now
see in LM studio that's generating tokens. And if we go to this developer logs
at the bottom of the screen here, you'll be able to see all of the requests
that are being sent back and forth, the speed, what's going
on, the responses, any errors. And we've set this up. And now we have functioning local models
inside of Visual Studio Code, which is super cool. So it's going to take a second
here to do this. My fan is now spinning up on my computer,
and my performance is going to be a little bit degraded
because I am recording my screen, so it might be a little bit laggy here
for you guys, but overall this should function.
I'll wait for it to finish, then we'll come right back
and see if this is working. Okay, so it actually just completed
the game here. Now there was a little bit of a glitch
where it was trying to access like an integrated browser,
which didn't work and it gave me some bug, but it's now functioning. It's created this huge index file,
this script dot JS, which is like 600 lines, the style.css. And while it didn't make it in react
like I asked for, it did make the fully functioning game. And now if I want to just open this,
let's just test it out and see if this actually works. Okay,
so clearly there's some bug or something in the chess game
because it's not loading. But the point is it did some coding. So you know, I to have to debug that. And maybe I should have given it
a simpler task to begin. But it is working okay. So that's how you set up the chat right. And this now is going to allow us to do
agent encoding. We can change the mode, ask agent plan
whatever, set up different agents, test them, see which one is going to work. We can tag different files and just use this like we would use
any agent, a code editor. However, if we want autocomplete
to function locally as well. So if we don't have any internet
that this will work. What we can do is install an extension in VS code
and this extension is called continue. So to install the extension you can go to
this little puzzle piece icon. Here you can search for continue. You can open this up and continue essentially will do the same thing
that we've already done inside of VS code. But it will just allow us
to, set the autocomplete, which is I don't believe, a native setting
right now in VS code. So you can install continue. This should be a button here
that says install. And once you install that,
you should see an icon on the bottom left hand side of your screen that looks,
sorry, that's not what I meant. And type looks something like,
let me just put it here like this. Okay. It shouldn't
show this weird kind of hexagonal thing. And now this is going to open up essentially a chat window, which is
a clone of what we just saw in VS code. So what we can do is we can configure
models inside of this continue extension. They're going to work the same way
that it would work natively in VS code. And we can configure the autocomplete. So what I'm going to do is just use
continue to configure the autocomplete. But you also could just fully use
this configuration for everything else as well. So I know
it might be a little bit confusing. Let me just show you what I mean. What we're going to do
is go to settings here from settings. If we go to models
you should see that it says like setup model or should show you
some default option or something. What we can do is just simply press this,
add button. We can change the provider
to say LM studio. And then for the model
we can just pick anything random. It doesn't have to be the one
that we actually installed if it's there, obviously selected. But if not, just pick anything
and just press connect. From here, it's
going to bring you to this config file. And at the bottom it's going to have
this kind of connected model, which is the one that you just added. What we want to do here is
we just want to change this model. So what it shows right here to be the name
of the model that we have in LM studio. So what I can do is just select this right
here. The Gwen 2.5 coder. I can change the model like that. And now it's good.
And we've simply just added this. And of course we can change the name Gwen
2.5 coder. However,
if we want this to work for autocomplete, let me just delete this because I'm
going to show you a finished version. We need to one second here. Let me get rid of this add.
They roll okay. So roles is just an array here
that says autocomplete. So effectively what you can do
is just copy what I have here. If you use the same model put the name
but the provider, the model, the API base which is just this, which will already be there,
and then the rules dash autocomplete. Once you add
that you can just save this file ctrl s, and if you come back here
now you can set this autocomplete model. And if you set this autocomplete model
now when you're typing inside of VS code, it's going to use that for
the automatic completions for the chat. You can also add your own chat model here,
and then just make sure that you add these roles and capabilities
like I have here chat, edit, apply, and then to use again, you can just literally copy
the configuration that I have and then that will work in this chat
window. In the continue extension, I kind of
prefer to use the default chat in VS code. I find it works a little bit better
and it edits the files better. I'm just showing you this because this is
how we set the autocomplete. But if you want to use this chat
window, you can and you can mess with it and see okay,
so now if I go to like index.html actually let's go to script,
I'll just write like if or something you should see that
we start getting some autocomplete. Let's just go like console dot error
okay whatever. And if I go back to LM studio
and I click into the coder model, we should see that
we're getting some token stream. And regardless it should be
working in that, LM studio view. Sometimes you need to restart VS code in order for it to work, but for me
that's pretty much all I did. And now the autocomplete is functioning. And again you can go settings is a bunch of other stuff
that you can adjust and change here. Overall, I don't change anything there. I just set the autocomplete model,
set the chat model stuff, and we are pretty much good to go
and that is going to complete the setup. I mean, that gives you
the auto complete model, that gives you the chat,
the edit, whatever. And now you can just do full local
coding on your machine. Now again
the results are going to vary here. This is not as good as opus. It's not as good as using
these cloud providers. But if you're on a plane
and you need to use this for a few hours, if you're out of credits
and you want to do something small, if you're doing, you know, smaller inline edits,
creating some functions, not trying to do like super complex
problems. This works, and it works pretty well. Now later I will do a video
going through the performance of these local models
and talk about that more in depth. But generally speaking, I just wanted
to show you guys how to set this up. If you found this useful,
make sure leave a like. Subscribe to the channel
and I'll see you guys in another video.