We’re in the 4000 engineers operating
8000 repos. We have new code contributors
that did not use to contribute before because everyone is an engineer
these days, everybody's burning through their budget.
Uber and Microsoft. How do you control the budget? How is the budget being managed?
The internet was a bubble. Did the internet go away? I love the internet. Now, when people ask us, do people
that use AI deliver more features? We can say yes or no. Is AI turning us all into managers. So. Beyond Coding. When I met you
and when I went to your talk, I was thinking, this guy is pretty far
in the whole engineering journey. You've solved a lot of problems,
and I want to zoom in to some of the problems
you solved and how. But right now, to start, what is the biggest problem
you're trying to solve right now? I think, like everyone, it's
a cliche at this point, and verification, specifically code
reviews, is something that a lot of the people in the industry
are struggling with. But as a whole,
I think that generalizing form that problem is the next frontier, meaning the bottleneck are going to move in other areas of your stock. Yeah. So right now it's a bit of,
I don't know, next week it should be like with security. You have release pipelines, right? Like that are also still deterministic
in old school right. Like so
you will have to figure release again. So I think what we are
trying to do is generalize and come up with a way to say, okay,
so we solve for code of you. Let's say we do. What is the next button. Can we predict it. Can we be there
before our engineers are hitting the wall? Yeah. And I think that's
what we're trying to do right now okay. Because it's obviously coming. And I think if you ask me,
I think the some of the pattern likes can go about upstream. Like can we generate enough business. And I think there's a, there's
a very good book that I really like. It's been 43 years
I think since it was written. It's called High Output Management 
by Andy Grove. And the metaphor there is it's funny,
he was the CEO of Intel. He got Intel to
where Intel was in like 80s and 90s. Wow. And and he talks. His main metaphor is a diner,
like how to make breakfast. And he says it doesn't matter how quickly
you toss the bread, it doesn't matter how quickly
you cut the salad. If your eggs take ten minutes to boil, then your breakfast will take ten minutes
to get out. Right? And that is
something we're seeing right now. So it doesn't matter how quickly our engineers can code
or how quickly can we do code of views if we can, for instance, produce
enough designs or PLD or high quality business heuristics, then we won't get anything
more quickly out there. Gotcha. Yeah. So it's really a shared operation. It must all needs to kind of work quicker
to get the whole thing out. Yeah, it must be like that. Like we are as slow as our slowest link. Gotcha. And so we are all depending on
each other, which is kind of nice as well. It's like there's no there can be
no blame culture anywhere anymore because we're all in this together
and we're all trying to operate. And bottlenecks
will move around in companies. So yes, right now it's called review. But before we go into how you're solving
that or how you're tackling this code review problem, can you share a little bit
more about the scale of the operation? How many engineers how right now
we're talking about 3500 engineers. Yeah, but it's going every day because everyone is an engineer
these days, right? So. We are seeing the group of engineers
getting much bigger. So people who contribute code. So that becomes a new problem. So we have new code contributors
that did not use to contribute before. So that creates another layer. And but yeah within the 4000 engineers and and we are operating 8000 repos and in mono mac mono repos all the way from monopole. That is like 25 years old to microservices
that are like three months old. Yeah. So it's a complex problem. And all these engineers are equipped
with some form of harness or a genetic tooling right out the get go,
right out of the get go. Most of them
will have some kind of an honest. And it's still developing. And also it's very hard to say
all engineers, because I think a lot of the industry
is focusing on software engineering, but there are so many different pipelines
that we're seeing that the workflows are becoming different enough from one another
that the harnesses will have to change. I'll give you an example. I have a mobile engineer and they need to do some app store
verification before they go to a release, because every release is happening
in a centralized way, right? Because it's not like you can do
continuous deployment to to an iOS app because you have to go through
like apps or review. Those people have to have
a different verification, honest. They will have to make sure
that the release is ready because like if I miss out on review,
then my feature is going to be released, I don't know, next week. And so it's very different to an engineer pushing code into our own web servers. Right. And getting some react about. So I think that's kind of like
a good simple example of like how different harnesses
are starting to become. And we see that course
also data workflows and infor. So what are you serving. Right. Like so. And with that in mind we need to propel
some kind of like a platform. Gotcha. And that's something
that is hard to still build. And it like so it's not it's not clear
what the right way is yet I think. Yeah I'm trying to get a better understanding of this big problem
that you're solving. And so far you've mentioned three aspects,
right. Engineers are building faster. They have different disciplines. So the verification is also different. And then you have engineers as well as non
engineers now building and contributing which amplifies what you build but
also likely the quality of what you build. Is there anything more that kind of adds
to this scope of the verification problem,
our customers that we need to sell them. So I think businesses need to look at themselves in a,
in a very interesting. Okay, I'll start again. I'll start with the
with a good with a better example. So I used to
when I started working in the industry, everybody says that we should do
like Microsoft is doing, right. Like regardless of how Microsoft
is releasing the software. Then it became look. But Google is doing things that way. Like they have their own like mechanisms
of doing like CI, CD or whatever. And now having looks at the main labs like OpenAI and and saying like,
look how they release. But cloud code has like an uptime of 92%. I cannot have this the same time. I have to have nine, nine, nine,
about five nines. Yeah. Like in order to make my business stick
because it's a different business. So like I used to say to my engineers when it was the Google days,
we are not Google. I cannot afford to be like Claude. I cannot have downtime, I cannot. So quality of code is also important. And so when I say customers,
I mean like my main business goal is to keep my customers
happy and coming back. And that's the most important thing
first and foremost. And it's easy to forget these days
that this is the main, core idea of every business. Right? Like to serve the customer
so we can move fast. But if I move fast and I break my poor
DeVry week, then what have I gained? This is an interesting pitfall that I have
seen kind of some leadership teams on. Some people in a leadership position
be like, look at what they're doing,
or look at this blog post. And without this core understanding
of my business is fundamentally different. And I cannot afford to go like them
because look at their uptime. Yeah, it's
crazy to me that we have that right now. Like, again,
we build an e-commerce, right? Like if you walk in an e-commerce website,
like your uptime is, your brand equals the trust customers have in your brand
and how likely they are to come back. And so I cannot afford to not be there. And so I think a lot of us
are forgetting it right now. But it's not the first time
this is happening. Gotcha. I think that's what the experience is
to be a bit more pragmatic and be like, yeah,
this is a big thing happening right now. There are many changes
happening in the industry. So this is a real revolution, yet
it doesn't change the way we do things. And we should still keep in mind
the core ideas of like providing our customers
with a good product that they can rely on. How does this way of thinking
about your customer and your uptime translate
into the verification process? And is verification just a pull request
review or what is verification to you? Verification is a lot of things. So yeah, a review is one, right. And then we are now thinking about it in terms of a stack of agents
that can operate together. So basically we're trying to control
context window and code review is built out of architectural guidelines and on top of other,
let's say, instructions that our engineers would like to give
to the code review agent. And the goal of the code review verifications, let's say agent, is to help a human being review things
faster. That's one. But then on top of that, we have other
layers that we are now working towards. So what we are starting to see, for instance, is the we're going to see
a generic security. So a lot of models are now being used
to detect any security issues or vulnerabilities
before traditional scanners can do so. And so this is a layer
we need to build for as well. And as I mentioned before,
I can run an app store agent that says make sure that I didn't break
any regulatory aspect. I can run a financial regulatory
compliance agent that says, okay, make sure that I'm
my change is not breaking anything. And so verification
is starting to become this stack of multiple agents that produce different types of output,
sometimes also feeding the next agent. And so you need to think about it
in the context of a series of capabilities that are built on top of each other
that have also different owners. So you cannot own everything as well. So you need to make sure that the owner can also control part of their workflow
without breaking the whole system. Gotcha. Yeah. Earlier you mentioned
verification harness, and now I understand it better where you have
either a specific harness or an agent running in that harness, doing
specific checks for either your context or it could be security
or it could be compliance, or it could be code quality,
and then even code quality on different aspects of technologies based on
is it mobile or is it front end? Is it back end?
This is getting quite complex. Where do these verifications run? Is it all still in a pipeline? Does that make sense with agents
or what are your thoughts? The infrastructure for running those
agents is one of our main working areas. Specifically,
my teams are involved in building the infrastructure part as well. So yes,
getting those things to run safely and quickly is a big problem by itself. And you can start seeing
the big companies are offering it. Specifically, cloud providers and others
are trying to solve this problem because you need to be able
to spin up machines, whether it's like Michael VM or container or whatever, that is secure enough so you control what the agent has access to, and also quick enough to spin up and down, because you're going to have like hundreds
of thousands of those at one point. And so this is one of the main challenges. And we are still trying to figure out
what is the best technology to do. So fundamentally, does this run this verification step
that has a multitude of agents? It cannot run on every change. Right. Because I feel like building
is quite quickly. Then you have the traditional pull
request code review aspect of things. But will you do all of these checks? Because agents are also quite costly and it could be a latency issue. We can talk about cost. Okay.
I think it's a reckoning time, right. Like everybody realizes that I was there
when the whole cloud migration happened as well. Yeah. And in the beginning everybody was saying,
don't worry about cost. Everything is going to be okay. We're going to move to cloud
and it's going to be great. But cloud providers have to have margin. So obviously it became more costly
than hosting your server. And I think the same thing is happening
right now okay. And so cost is becoming a button neck of its own. And what again,
this is a good example of where you need to stay pragmatic
because we don't know where we are headed. So back in the day of internet, everybody thought that Cisco
is going to be the biggest company in the world
because they thought, oh, the infrastructure where the internet is
running on is going to become the most important commodity
human beings are going to consume. Cisco is not the biggest company. Out. The model company is the same. How much of a commodity
is a model company? And are we going to see more open source models being raised? Most of them are coming from China,
for instance, and China is starting
to introduce legislation on those as well. So cost is going to become
a very interesting conversation. It relates to many aspects
of how this industry is building itself. Yeah. Because also we've we saw
a spend over CapEx on the scale of like 1.5 trillion. I think somebody needs to get paid back somehow. Yeah. Are we the one who are going to pay for it
as a customer? Maybe. Maybe not. And so I think looking into that from a perspective of, of a systematic thinking across the industry,
we have to bring it back to our day to day and be like, okay, we need to be open to
all of us, all options that we may have. So whether the cloud providers are going to undercut the model where they're we're going
to see improvement in inference, that is going to be significant,
like a ten x or 100 x improvement in inference cost, and whether we're going
to see local models becoming stronger. So maybe 128 gigs of Ram is enough
to one more stacks on your laptop. Maybe not
now, maybe in five years, maybe in a year. We need to be open to all of those possibilities, and we're trying
to keep our heads open for this. So we build our infinite capabilities through that perspective,
through the idea of like, okay,
I need to be flexible enough to move. I remember people thinking that the angular
is going to be the winning framework for web development. Like, I don't think people remember
angular anymore, right? Yeah. It changes like things change. It's it's important
to be aware of the fact that the software is moving fast. And what seems today
like the best practice is not going to be the best practice
next week. So you need to be kind of pragmatic
about those things. Yeah. Out of any of those options,
sometimes the listeners, my listeners in the comment
section can think quite black and white. And I have seen people give feedback of
this is just the bubble, right. And what happens when a bubble pops? What we have goes away. The whole bubble just disappears. For me, this is a technology
and costs are increasing. I don't know
if now is the time to think about costs. It's definitely becoming more cost
aware the industry. But will this then go away? Because that's
none of your options, right? The options were either we go this or we have this,
or we have this to manage the costs, but the technology stays. The internet was a bubble. Did the internet go away? I love the internet. Yeah, exactly. So I think yeah,
we're kind of on it right now. I think you could have a bubble and a
technological revolution at the same time. Often it comes together,
I think, and there's a reason it vestments go crazy right now
because I think there is value and people understand what the value is. We just don't know the economical
structure that will come out of it. So I'll give you an example. During the internet evolution,
the poster child of the bubble was which sent you dog food at your home. Most of my friends don't buy dog food in the local shop anymore,
so their business model was right. It was just 20 years to early
in terms of operational capability, so a lot of operational aspects
had to evolve before we could get there. So for instance,
we needed to have the revolution of the warehouses
outside of cities that Amazon is leading. And then now other companies
are doing the same. We had to have better delivery systems. We had to
digitize most of the delivery capabilities that were still quite analog in the 90s,
and we had to do a lot of things, but the ideas
still propagated into the future. So sometimes ideas are too early,
and that's where bubbles are tied to. Sometimes it relates to
there are not enough customers. So most of the bubble exposed because there
was nobody to pay the bills at the end. Now we have everybody on the internet. I don't think 99% of human beings
know what agents are really these days. Maybe they will in five years
and it will be completely obfuscated. So people don't think that they are
surfing the web when they use their phone now, like they
don't need to open up aDSL, right? Like logging and run the connection
like we used to do when my phone used to call a server
and I used to edit my mom when, when I was like 11,
mom, don't pick up the phone. I'm connected to the internet.
I'm trying to connect to the internet. We're not there yet. I like I don't know
if we're in that place in time where agents are good enough
for the average person to use. Gotcha. I was thinking this actually,
where I recently shared that I'm doing a lot of speech to text,
and one of my friends is a little bit older of age. He was like, really? Like it's it's gotten that good. And now he uses it and he loves it. He sent me a text recently being like,
thanks for sharing. I'm using it everywhere now. And I was like, I am right now quite close to what is going on. I'm trying to keep up to date, but
at some point I'm going to be at a level also in age where I'm not going to be able
to do that anymore, and then the new generation
is going to surpass me. That grows up with agents natively. And I grew up with the internet natively. Like I didn't have dial on internet. It was just always there in a computer
and it was a shared computer. And then at some point
I got my own computer. And for me, it's hard to imagine a future
where people grow up with agents and they are just kind of their ubiquitous
and entity where they can do things with. They can either ask questions
or they get an answer, or it solves problems that I don't even know we have right now,
but they're solved then. Very strange to think about. The people are going to be Agent Native,
and sometimes I feel like we're not that early. But then I realized in the grand scheme of things,
we are very, very early right now. Extremely. Yeah. We are still talking
about the cost of owning multiple agents. This should be disappearing. It's like a,
I don't know, memory in the 90s. Well, people thought, oh my God,
how will we have, I don't know, more than 256MB of Ram like this should disappear,
most likely with some kind of like a technological revolution
or maybe even a research revolution. We don't know yet,
but the seeds are being planted right now. Do you know General Magic? One of the story of general magic? It's a really beautiful one. It's in the 90s. The the team that created
the original Macintosh started the company in 93, I think, and they gathered
probably the most talented group of people to beat what to build
what they called the crystal. The crystal was a device that was handheld and was supposed to help you connect with other devices,
and it had its own operating system. And basically they're
describing the iPhone, but they're doing it in 93. That's crazy. But the people
that came out of this company are the people. And the Rubin who did the android and Tony Fadell, who did the iPod
and then made the iPhone. And it revolutionized
the industry two decades later. Yeah. So I do think that what we see right now
might be too early, but ideas have to go
this way, at least in tech. And like the PC being thought of
in the 70s and only coming to fruition in like late 80s and beginning of the 90s,
interesting people have to be wrong for humanity to,
in the end, have a solution that is right. Yeah. Also right in time,
but also right for solving the problems. Yeah, people have to be too early so we can have enough time
to think about the problem deeply and be like, okay,
we need to figure that part out before the technology
is there or before the market is driven. And but we like big things. I like that big things 
take time to actually get into the point where they're like,
oh, now it's a big thing. It's inevitable. Before that, you're like, you're crazy. You're crazy. Yeah, yeah, yeah.
You're crazy until you're successful. Yeah, yeah, you're crazy. But all of these people are now great
blank piece of product in Adobe,
Apple, Google. Like, yeah, they're crazy. They used to be crazy. But like crazy does things. Yeah, yeah. I feel like you need craziness and obsession
also to solve very interesting problems. Yeah. And it's also interesting to see that when these people speak about what they want to build, there is also a sense of inspiration that is not practical, like anthropic hiring English majors and philosophers to help Claude become a bit more of a coworker or somebody
you would like to work with. They're doing that. Yeah, well, there was a maintainer. I don't remember her name. She's amazing. She understands the fact
that it's a statistical model and yet,
like, it interacts with human beings. So they're trying to build it in a way
that the interaction is actually. What. Yeah. Yeah. Like the working
on the mix of using an LLM, which sounds crazy
because it's like, wow, it's magic. It works. Why do I need
but human beings or human beings, we are still supposed to be
the consumer of this, right? Like so. It's interesting to see how those companies have ideas
that look a bit crazy in the beginning. And they do come. Become very valuable later
on, like extremely valuable. And it's like obsession
about the low time or first time to paint for from Google. That said, the industry apart
by saying I want people to render the search page
within 20 milliseconds instantly. Yeah, it creates
a completely different experience. Yeah, yeah. Can you share a little bit more
about the relationships you have with the Frontier Labs? Because you shared this with me
before the show? I am very jealous. But at a scale of engineers that you have,
and with the capacity of booking, you have some interesting relationships. No, we do have interesting. Everything that is public right now shows that
we are working together with them to get the the main platform the right way. So does the customer side of things
that basically how do we get our customers the best experience? On a technical level,
we are still exploring together. So meaning the big labs are also trying to figure out what works at enterprise
care, what works at smaller scale. So that's that's
one of the right of the nicest things to to see from them
how they're also confused. The the road is not yet paved unsolved. Yeah. Everything is unsolved. Everything they, they would like
to get us on board with like cost saving, for instance, but they don't know how
to do cost saving at scale. And I was scared for sure. And so the levels are kind of
like a design partner. And we are helping them
design their experience, but also their helping us understand
how can we do our work better. And are you in close relationships
with one of the labs specifically, or do you have
those relationships with with everyone? Yeah. That's nice. Yeah. You have to like we try to be
as open as possible because again, you don't know who's winning,
like how much of a commodity this is. And you really don't know
if OpenAI are going to be the winners or a topic or Google's. Now, meta just announced, I think, two days ago
that they have a new developer model. It's pretty good. It's quite good, cost efficient. That's what Mark is saying. Like it's
I think he didn't tweet for three years. And then his first tweet is like, OpenAI on topic,
your your margin is my opportunity. Yeah. Yeah. Absolutely. Like so we don't know. So we,
we try to work with as many partners as we can and,
and they'll try to support us. And we're trying to figure out together
what is going to serve our customers best, whether it's an internal customer
like my engineers or external customer like booking is serving on the daily basis
in this world or even enterprise environment
where problems are unsolved. Can you share some of the problems
that you have solved or that you're happy with decisions? I am very happy with the way we measure impact, and I think we did the pre-work again,
going back to the Matic approach, we did this work anyway. Four years ago,
we set out to build an event system that allows us to understand
what's happening within our, let's say, SDLC as a whole. So we wanted to find a way to detect bottlenecks three years ago already. We called it the debugging the SDLC. And so instead of like making targets
or building some metrics that people are trying to gain, we said
this is an investigation tool for you. And so what we set out to betrays
regarding developer experience is now very useful
also for genetic experiences and the impact of AI and how we think
our life of certain investments. And all of this is possible
because we did the actual work of building this foundation
four years ago or four years ago. Yeah, regardless of AI,
I think, again, like if you concentrate on what business value you actually create
and what your customers actually need, then you just see
is another tool in your toolbox, right? Like and then it's important. It's a technical revolution. And yet it does not distract me
from the value I would like to create. And so now it's important, right. Like everybody is talking about
like the cost. And is my investment actually fruitful. My seeing
what like any anything out of my millions of dollars of investment 
and I think everybody is talking about it Uber and Microsoft
and burning through their budget. Yeah. Yeah. Everybody's building to their budget.
First of all, how do you control the budget.
How is the budget being managed. And we're talking about routing. So model routing
is becoming a big conversation. All of those things are not possible if you don't know what output
you're generating. So for instance we have a measurement of like a CTL and blue versus a feature deployment. What are those acronyms. So I is keeping the lights on. Yeah. And you as business as usual. So instance CTL would be making sure that our observability is up to date
with whatever. And business as usual
is developing features that we are trying to develop over, you know, a few years and that are foundational. But then you have like actual feature
development things that our customers see,
which is like the real output. Right? And so we can do separation of those
because of certain things we put in place. Yeah. And so now when people ask us, do people that use AI deliver more features,
we can say yes or no. And it depends. The answer is depend for it
depends. Gotcha. What are some of those building blocks
that makes you answer the question of? Is AI actually developing more features? First of all, good people
like I work with amazing people. Like they're really they really care about the problem. So all the all of the people in my team
genuinely cares about developer experience. They are genuinely caring about measuring it correctly. So most of my engineers
would be very data literate, meaning they will not come to conclusion
too quickly. And and then from that point on, we kind of cared more. Mostly we cared about the correctness
and the availability of data. What does it mean? So when you collect events
from different applications, there's always going to be
a problem of sanity, and there's always going to be a problem
of what this does this event mean. So I'll give you an example. Am I starting to code
when I move my ticket in Jira to in Poggers, or when I committed my first commit? Or what is the starting event
of what you want to measure? So for different types of development, we see different types of starting events. And so this is the kind of flexibility
that we try to introduce very early on by saying I don't care first about
what does it mean. The most important thing that I can do
right now is make sure that this data is reliable,
that it actually comes from the tool on a predictable manner. So and I mean that
because the scale is insane. So we're collecting
like millions of events a day. And, and I managed to get out of it something that afterwards can be processed
properly. And so reliability and scale was the main two things that we were focusing on
in the first year or two. And then all of that,
you can really build a reliable system. So right now people are coming to us and
be like, okay, let's get some intuition. And then we do, I don't know, a day of digging
into the data and trying to figure out what do we actually want
to track out of it. So output for instance, classically it used to be a lines of code or commits
or all of these things. We don't care for that because like, who knows what kinds of code
people are actually pushing in the code. Like, I don't know if that's actually.
And it's also very easy to gameboard. Yeah. More more better. Yes. More more better. Exactly.
Like generate more. Make sure you like, make no mistakes. Now, nowadays. Yeah, I actually think that like working
with the models and trying to write with them.
They're terrible thing. I don't know if you noticed,
but like I feel I don't know. The models are not good at writing at all. And so I think a good measure
these days is how to cut down 90% of mademoiselle creates
and actually write what you want to write. So conveying an idea 
is still a matter of being concise more now than
ever, because it's very easy to create. I don't know if you have this experience, but like a lot of people are now creating
like 40 pages documents super easily. Yeah. And it's actually moving us forward. I hate it, it's awful, I hate it. It's a awful experience. You can also see the way that the document
is structured and you're like, your brain is already
oh no, this is this is slop, right. And I think it's something
that also we are trying to avoid. Right. Like so you can usually explain things
in one page and use normal words and not like create bullet points
that in bullet points in bullet points like hey, I like to do
and this is the same for code. And do you measure this? And it's the same for code and
it's the same for any output measurement. And we measure other things
we measure like for instance frequency of changes or we measure. Again
my goal is to understand what prevents my engineers from actually moving as fast
as they want to to work. Like, I don't know, I 20 years
in the industry, 99% of the engineers I met quite keen on moving
as fast as they can like so. So it's out with that. I passed the people I work with,
so I trust they want to do the best job
and they want to move the fastest. And so something is blocking them. And my entire goal is to figure out why. Why are they blocked. And from that point you need to build
your kind of metric system. So not from a place of like,
oh, is this engineer is coding enough, which is like a lot of other people
confuse this with. And so we don't have that culture,
like our culture is really focused on like high trust
and trying to figure out what our engineers can actually achieve
within our systems. And it works. If a listener is listening
and thinking, okay, we don't really have
measurements of output or we have something and I don't think it's that reliable
or it's kind of a work in progress. What's the starting point? Because you mentioned quite
some systems need to be aligned in terms of getting events
or even an idea of output, and lines of code
and number of commits are all gamble. So if they become the goal, then everyone wins
because that's very easy to increase. How do people start? Okay, so it depends on your size. And the smaller you are, the easier
it is to set up. And mainly because ways of working
is a big chunk of it. So for instance, you need to educate
your engineers to move the tickets into like in progress or build some tool
that does that for them. Some companies have it,
a lot of other companies don't. Which one do you have? So we have past mechanisms
that we put in place both. Yeah. And mainly because we want to work
with our engineers as partners. And so I would start with workflows
and understanding how your workflows actually other instead of
just like imagining that that there's like this mechanistic way of working and and then I would start by connecting
as many tools into like an event store. So it's very practical. I'm giving you the path that we took
and avoid in the beginning, any assumptions about what you want to
measure and how you want to measure it. Be a bit more curious
about what you're going to learn. Mainly because we were wrong
many times about many topics, and we figure out 
more important metrics later on. So for instance, as I mentioned, you cannot compare
an iOS developer to a web developer. It's not something that you can do. So this type of persona only comes out
when you look at real data and be like, okay, it seems like
we have a systematic difference also on that level in the measurements
on on that level in the measurement. Yeah, you can really see it in the,
in the event. So you can really experience it
or at scale at the scale of events and like what comes before
what and, and many other aspects, you can really feel
that somebody is an iOS developer and so or which code base they work with or like what
the code base is written in or like, what kind of Cicd pipelines do
they have, or a million other aspects. And so I would start by,
as I said, good people that really care about the problem,
figuring out how you work, how your engineers are really working,
collect events. Once you have that done, you start starting point
so you can start digging into your data. So we still do it to this day. We go and we talk to business leaders
and we say, let's write SQL together. Especially now. It's super easy. So then we can say like, I don't know. Show me how many changes
were deployed together in the past month. So like per deployment, how many changes
were introduced into this release. And, and then we can have kind of like an intuition walking through the actual
like event system. And I think from that moment,
you need to go back to your business leaders and be like,
what do we want to achieve? Remember in the beginning I told you
like the the button excel everywhere. So if business cannot define what they want to achieve, then I'm not going to tell them, yeah, I'm
not going to be the one telling them, oh, we're achieving some amazing output
because we commit ten. The amount of code is just is this the actual output
that we're looking for? And so I don't know, your
your business might have modernization in place
or some new features or even an entirely new like product
that you're building. And so output can be measured in different
ways across those different initiatives. And so I would focus on what you want
to get to begin with. And then you can measure
if we're accelerating or decelerating or are we stuck. Because then you have the context
in which you walking. How do you bridge the gap between this event store,
which might be quite technical, and then what
someone from the business side might give you, which is more revenue,
specifically in this part of the business or this domain,
those who need to kind of be close, it needs to be
that the by tools used to bridge the gap. So we used to have like this
Tableau and looker and all of those. And I think now because of AI
capabilities, it's much easier to to actually talk to executives
because the executives ask you something in real time, and you can get this data
in real time in a room. Yeah. And if your data store is built
well enough and again, that it sounds easy, it's
not easy at all. And like people always underestimate
like the scale of these things because small amount of actors can generate
huge amount of data, right to work with. And the way you structure it is the is not something that can be generalized. And like there are many tools
they try to offer it. And I think those tools work
at certain companies, but not in most. So we have our own custom tools
because we tried. Yeah. And it didn't work. So it's that that problem to begin
with is not easy. So then let's say you do get to the point where you have like a scalable machine
that you can actually query. The easy part right now
is to actually query this, this machine and be in a room and be like,
let's find let's have cloud write the query to go over the SQL
and get us the information we need. And you want to introduce this curiosity and kind of like a serendipitous
adventure, because it's possible these days to actually ask questions. Life that used to take like hours
or you needed to have like some kind of a data engineer to actually pull out. And and so I think if you do have something that is reliable
in place, people will touch those numbers and we'll work with you towards like,
oh, okay, something here is really broken. So it's not what we thought,
but then we can fix that, that problem. Can you share a little bit more
about the type of events that live in this event store,
just for me to get a better picture of? Okay,
so we collect things from all the way from a commit. And like the data of documents,
including the metadata itself and the context
in which those commits exist. So for instance, you have a mono repo. And in this monopole
you have several components. And so changes that happen in that
monopole you need to have some context. So if I change one file
I need to correlate it with some component downstream. We collect any CI event. So all of our build events deployment and then we collect also as I said meta around it. So this this component
get out in a big release or in a small release or it's like in a do
you need to release something altogether. So for instance,
sometimes you need to release multiple components together
and so you need to wait for it. And we have information about the tickets
that are connected to those changes. And we have information
about like labels on those tickets or labels within the changes itself. We have information
about review processes, and we have information about like all of
these are events that we are collecting. Gotcha. Yeah. Do you have a because when you mentioned
kind of answering specific business outcomes, that's
where you go deep and do that together. You co-create energetic tools, help
you do that more on the fly. Is there like a standard dashboard in terms of metrics
that leadership teams started? We started with the
with the standard dashboard. And it's it's less useful than like custom
made solutions. Yeah. Like it's much better to give
our leadership a possibility to query. Okay. Then to have a standard dashboard again
because then like metrics become, you know, good. Also,
do you know the story of the corpus? I told it in the talk. You know the story, I forgot it. Okay. So the bridge in the 50s,
I think tied to help the, the the Indian police
get rid of cobras in the street. So they introduced like a ₹1 per cobra
and a reward. And so instead of getting cobras out
of the slave people created Cobra farms. They were cobra to make more copies. And so when they stopped you,
you ended up with more covers. And it's called it's like it's a fable,
I guess it's a paper, but in reality it's every time you have a measurement
that becomes a target. So it's called Goodell's law. Then that measurement
is ceased to be useful because people can game any target. And so the idea I like that you want to, to find out is what is my current status in in regards
to where I am right now. What do I mean by that? If you have a static dashboard
that just gives you numbers, this is your deployment frequency,
then you're always going to tell everybody in the company
you have to have a deployment frequency of like, I don't know, five
five changes per week, whatever. But if you have a dashboard
that is not set in stone and it's something that is investigative
and something that even can create its own insights,
which is like the next generation of what we're building, then your leaders can see the problems
within that context and not fall into the pitfall
of actually trying to enforce met my targets that are going to make
our measurement useless again. And so in practicality, this means that like
if you a leader in one org, you might see that your teams have issues
with the review process. So for instance,
you don't have enough people to review and or and you're in another war
or you will see insights that look like, I don't know, your CI
pipelines are too long because, you know, flaky tests,
flaky tests or whatever. So that's the context that we are driving, or at least that's what we're trying to
to get our leaders. Yeah. Very interesting. Like my my reasoning was if I have done
my analysis and a query, then at some point I want the visualization
of that kind of out of the box, right. And go to one page where I can see
if the needle then moves. Yeah. And what you're communicating is
I think one step beyond that. Like if that is
then the sole dashboard that you have, then the needle will automatically
only move there. And auto bottlenecks might arise
which are not aware of because you're looking at one overview,
one visualization, one dashboard. I wonder if you can then into the
practical, get something that is organic, that automatically gives you
the bottlenecks that you want to see. But that sounds like magic. And I don't believe in magic,
but we're in the age of magic. That that is true. Do you think we can get there? I seen it, I've seen any signs of this. We are building
some aspects of this already. Yeah, this is a problem
you're trying to solve. This is also a solution that we are
pretty sure we can provide. That's really cool.
Yeah, it's really cool. It seems like you have the right building blocks
to at least experiment and solve this. It's something that you have to, again, build on a proper foundation
like you cannot. You cannot do it if you don't have numbers
that you can rely on. This seems quite advanced. Yeah. Are that then still like,
even though you want to look at metrics that show the bottlenecks that you have,
and then you want to look at newer bottlenecks
that come up based on those metrics. Are there still certain metrics
that organizations can start with, or would you say, really
look at the data once you collect events and find those bottlenecks
and look at those first? I think the main thing I would look at as a business is
where am I slow? Where do I think I'm slow? And I don't know, like again, it depends
on your business and where you are. So I commonly work for an organization
that is like top 50 companies in the world. If you're in a startup,
you have your own problems. So you need to understand where the bottleneck
are as well within your own startup. So I think the one key take to to, to provide the listeners out of all of
this is like realize your own context. Like, if I am a small company,
I can go already into my GitLab and figure out
if my review times are terrible or if my CI pipelines take like,
I don't know, three days. Sometimes in startups,
that's what happens. And so there's a lot that you can do
even if you didn't collect all the events. But I think taking actions require you to actually have some kind of
like a foundational work done first. And so that's where I would advise
to, okay, look into your problems,
figure out if you have any and what those problems are
and then start collecting information. And I think that's the right way to go. Again, we did this for our company
with another victim. It was like really a few people. Few people for how long? For two and a half years. Yeah. Many mistakes, many learnings. But I am very proud of what
this team could accomplish. And I worked in many startups before
and it works like a startup. Nice. So they're very productive. And I think you can do a lot with the
2 to 4 people these days. Absolutely. Yeah, yeah. How do agents and the metrics
that you capture from agents that come into play within these events
or within these insights, when people say we have quite a substantial investment,
the investment keeps increasing. What do we then
see as ROI from that investment? So that's a good question right. But you need to give your leaders a way
to answer this question on their own. I think we are having a moment in time
right now where we provide recommendations. But as we move forward, different leaders
will want to prioritize different things within our company. Specifically, I think that some people
want to see a better quality, and some people want to see a better
velocity, and some people want to see less incidents, less incidents
or better empty or whatever. And so it depends. And at least from my perspective,
our goal is to be able to provide all of these people
with the solution that sells them. And so I don't want to be the one saying,
oh, you have to do X or you have to do. Why? Oh look, I am there to help them with
like insights so I can come and say it. It looks to me
like your code review time is way longer than the average. Yeah, I can do that. It's just an outlier. Yeah, it's an outlier. Maybe they'll say, you know,
I don't have any seniors. So it's hard to review these days and all. I know they're on their own ideas
about like why things are going on, but they have the context,
they have the business context. And so I would start from that. And I think like what
you hear across the industry and also from everyone,
like is a hyper focus on coding, but the rest of the business
will have to use these tools as well. And we'll have to keep up with what
coding and agents can do. So the rest of the business can be,
I don't know, like a marketing department that has like we talked about it before, like content and and like specifically UGC, right? A marketing department can have many tools
built these days that helps with the operation that they couldn't,
I don't know, even two years ago. Yeah. Those tools are now real software products and they need to be settled. Maybe yesterday
they didn't think about it, but when it's down next week
or they're losing the, I don't know, 50 data points about like their creators,
they will come to us and be like, hey, can you help us solve for this software
product that I've just built? I don't know, vibe coded? Yeah. So it's coming. So we we are just going to have more
and more customers that are saying, I create software. Can you help me make the software
run more smoothly or be more operational? And, and I think it's clear
that we will need to serve those people. It's like a classic Javon Paradox. Well,
we build two more lanes in the highway and we just get more cars driving in it. So it's we can see it already. I can see it already, like people
coming to us with classical software requirements like,
you know, I need to to test uptime or I need to even understand
how do I backup my database? Who has who have no experience
with coding or software at all? How many? I'm personally, I'm very happy about that. I always thought that coding should be
something that is accessible to everyone. It is now. Everyone can be a builder
and is a builder if they want to. It's amazing. How do you know
there's some gatekeeping about it? But like as a person who find out
about coding as like when I was 11,
feel it always felt like a superpower. And I'm so happy
everybody has got this superpower now. Yeah, it feels more of a superpower
now than I think years before even. Yeah, because it's so available. How do you help those people that now
create prototypes like mushrooms that just spawn
from the ground? Applications can spawn up as well. And if it's a really good problem solver,
they can become reliant on it and till something breaks
and they might not know how to fix it. Which means they need
kind of a central enablement team or center of excellence
that can help them with that. But typically engineers, when something is
ripe coded, it's now a meme, right? Yeah. It's slop or I don't want to do it
and they shouldn't have done that in the first place. But that's not really helping
the organization or the people
that have become reliant on it. You can't be like, don't do that. Do this instead, and come to us
and we build it from scratch. They can build, so they should. But how do you still help them? I believe we're going to see. Lovable for the enterprise. For sure. We're going to see these tools are coming. But right now our engineers luckily are very happy
with other people developing tools. So we have again,
we have this culture of like, let's say, joyful curiosity
with a, you know, reliability in mind. So because I have SRS and a software
engineers, it's it's a nice vibe. So specifically I don't see this problem. And also it's a cultural thing that is important for me that we respect
everybody that builds. And I think we can provide them
with better guardrails. I don't think there's an industry
standard these days about like what access do we give? So for instance, we do have a company is now building
like a centralized MCP and skill. And then on top of that security
is coming in and be like, oh, let's make sure
that they don't have access. And then now compliance is coming
and be like, okay, let's make sure
that no data is leaking at. We still don't have the flexibility,
less reliability as an industry standard that I think we should have,
but I can't imagine where this is headed. Meaning there will be a platform
in which people will be able to vibe code their own solutions
and on the constraints of some sort. And I think we're going to see that. So you will I don't know, in marketing
you will have access to a the G suite and like I don't know like our marketing tools in
HR you will have access to work day and other tools. And I can really see
that happening already. It's like it's the first thing. You know how everybody says
Excel is the software for everything. Like it really is one of the best
software tools ever made, right? Like because with Excel,
like you can build any software because it's basically a database
with UI on it. Yeah. And so these people
that are now coding tools internally used to do things in Excel,
so there's nothing new about it. It's just that they're now able
to streamline these data and the UI and the user experience on top of it
in a way that is more advanced. And so I think we will see
solutions coming up. But so companies will have to solve it
internally. Yeah. Interesting. Yeah. Right now they have tools to make sure
everyone can be a builder. And then there will be tools
to make sure they are better builders. Yeah. Within the context
they are operating in and better builders. Or that the tool is actually maintained
because building a bridge is much less expensive
than maintaining a bridge. Absolutely.
It's always the case for software, right? Like building something is always
the least expensive aspect of it. And so it's something that we in engineering
know about. But people who are not used to this
feel like I build it. It's done. My wife is a lawyer. When she's writing a contract, she give an output away
and now the contract is sealed. Immutable. Yeah, right. Like black and white. We are in while we called engineers. And we are in the world of engineering
because our artifact deteriorates
and needs to have maintenance. It's like a stone in the wind,
like we have to maintain it somehow. And so looking at it from that perspective
is something that is not intuitive. It's counterintuitive in many ways,
and you need to be able to give people these tools
to think about this. So we all know
observability is like basics. Do that as a marketing person
that is brilliant about like what they do and they build their own tools
and they're like kind of spinning up their pipelines
ten times. Care about the observability. Do they care about it? They don't like why would they like? What they're doing is an entire job. So we need to happen with that. Yeah,
yeah. What a beautiful example. How black and white
something of a contract is versus the art of creating software. Yeah, just the close of metrics. You gave some examples of
what is then in that event store, anything from geo tickets
to some of the metadata on change build
even running in operations. Have agents now also contributed in events or kind of a genetic interactions
or artifacts. Do you have some examples of those. So it's clear that so
we have observability around agents that is built mainly on the cost
token usage. And like how many calls did
we can make to the API. So we need to understand if the agent is. So I think they just released
this article about like Sonet like being less effective than opus
because because it uses more context. Yeah. And I think we need to track that
at our scale. And it's early days,
so I assume we will just start collecting more and more information. And obviously agents
that operate within our pipelines already generate events,
as any other engineer would. And I will see things
that are completely anonymized. So my an agent or a person, it's the same. Yeah. So I don't care. By design we are aiming to be like on a, a, a granularity level of a team
or this level of person. And so it's easy for us to just track
agents the same way that we like people. Interesting. What about agents
then that are augmented to humans. So a person can have one agent running multiple agents
running for the same piece of change. Do you have any type of metrics
there? Interesting. So he's a I turning us all into managers. Some people have said the best managers are not the best engineers
because they manage. But I also I think there's a cost. I think as much as engineers. Would love to operate this for on a long to operate
like this on a long term, it's kind and we start seeing that. I think we are going to see
an understanding that engineers will have to be trained
with, like something that is similar to managers
and how to parallelize how to work with like a multi context approach,
how to not burn out basically. And engineers needs to put their headphones
and work nine hours a day. In an ideal world. Yeah, yeah.
This is why I love being an engineer. We just talked about that, right? Like it used to be magical for us. I think that it's not the feeling they have right now
when with the way they're working. And we will need to kind of guide them
through this or build layers that allow them to do this
a bit more seamlessly, if possible, because I think it takes it all
and I can see it. I can see how a lot of people
are can be guided by this. So going back to your question, do we measure the relationship
between human and an agent? We don't have that correlation
because we try to avoid that. We do have the context in which, like
how many agents are running versus human beings and at scale. So I'm not trying to figure out
what I parallelized the engineers. That's not what we're looking for. And we do care about how engineers
are actually using the systems and if they're getting
what they need out of it. So we do care about the actual developer
experience of AI as well. Yeah. How do you measure
the developer experience of AI? Oh, we have an amazing tool to measure experience as a whole. We have a survey tool called Get. Yeah, that is now
I think you just bought them and it's, it's allowing us to ask our engineers
every few months big questions. And it covers insane amount of data. So I just described you
the first aspect of what we measure, which is the all the systematic metrics. And basically the events store. There's an entire world of experience
that we're measuring as well to balance that out. And why? Because the wrecked
input from our experience is sometimes more informative than going through millions of lines of data. And I'll give you an example. We think that our we used to think that our review experience is enough and it's not. So we now know because of this survey what to focus on because they tell us,
I need you to help me. I don't know if through my interviews
or whatever. And so this is the
the other side of a strategy that was based on qualitative and quantitative
analysis of the vocal experience. And so we invest a lot in asking them
about AI and other things. The machines, how do they enjoy our
infrastructure and the release experience? It's a whole tool
and it's been very useful. And I think
we've learned our seventh survey. So it runs every six months, and people are still learning about this
first or second survey. So that happens like three years ago. People are still investigating that one. Well yeah. It's it's a it's a gold mine of of data. I've been in companies where
sometimes it's quite on opposite ends. The thoughts around surveys. Right. Measuring things we've tried
it doesn't work or we're now measuring. We're sending up so many surveys, qualitative data
that people have survey fatigue. Yeah. How do you find the sweet spot
or what is your device. First of all, we build
a very good program with very good people. And that communicates
why these surveys are being done. What are we doing with this data? What came out of it? So for instance, what programs
are now running based on those surveys. So before we do we launch a new one. We always make sure that we did
a lot of communication work around what the previous one did. And we have an brilliant team that does this and goes
to each leader in the company and get a list of things that were done
based on the survey. So when we come to our engineers,
we'd be like, based on your previous feedback, we've done a list of 200 things. And so first of all,
that gets us in Eugene. Yeah. Because they're like,
oh, either they will tell us this doesn't work for me, because, you know, the whole joke about
like how to get an answer on second floor. So if nobody answered 
your question on second floor, you just answer the question wrong
and then they will they will correct you. They will fix it for you. Okay. Right. Exactly. So I think. This is a great experience. And our team is well trained enough
to process this feedback constructively. Meaning they will get this feedback
and we'll understand that some things are correct,
some things are incorrect. And we will find the balance in between. Okay. Maybe we need to give this program
a few more months to run before we change the direction. Or maybe we should do something
completely different today. And so it's clear that our engineers
want to work with us on this. And every survey that we launch. And it's every time
it's more than 3000 people, a every survey got 92 to 93%
response rate. Incredible, incredible.
That's incredible. Incredible. I'll community they really really care. And they they have tasks in us. And I think it's it's
so counterintuitive to to many leaders. But it's been working for us like magic. You don't have to chase people. People feel it in the as you do. You dislike them. Everyone 92% is incredible.
It's incredible. And people can and people get angry
and people like make angry comments, which is great. It's like you want people to tell you
listen feedback. I know we just moved to a new tool
that does X. I don't like the way we do it. And then everybody votes this coming up
and you know that something is wrong and it's very useful. What is an example of something
that changed based on this more qualitative
feedback of lot of things. I mentioned the review process. I release capabilities,
we try to automate them in a certain way. And people guided us through that. Procedures like our tooling, 
where do we meet our engineers? And we use many tools on like of,
you know, all the way from GitLab to our continuous deployment tool
and getting the context on where things are
is very hard at our scale. So they just told us, can you build me an
AI scale where I can ask Claude to figure out
where my deployment is in the pipeline? Yeah. And they just people just told us,
can you build this product for me and made this product? And it was,
yeah, it's really incredible. Great. We come to meet people where they are. So yes, you have the MCP for GitLab
and you have the MCP for a healthy factory
or whatever tool that you're using, right? Like AWS, whatever it it sees something
that you need to put together and be like, okay, this is how we measure our,
you know, my deployment pipelines. And this is what how we trace
where we are. And it's something that we had to build
because people ask us to build it. And I wouldn't know about that. Gotcha. When it comes to then, because specifically
you mentioned building the skill. My train of thought
has evolved over this in that I didn't really think having a central team to build skills and maintain skills
for other people that requested that was wise, because they might not have
the context and skills can atrophy. But now I do think that it's good
to have kind of a central team that maintains skills
that are meant to be shared and meant to be used across,
to serve and solve certain problems. What is your thought pattern on that? Do you have this central scale repository
our skills distributed? How do you view that? We do like everybody else. And the ownership model of a centralized
AI team versus other domain teams is something
that is very interesting right now. I think everybody is having
the same conversation across the industry, and the way we see it is like any other platform team, and we provide the platform. So we provide a centralized repository, but we prefer the skills like MCP to be owned by a domain expertise,
a domain like expert of some sort. So it can be a team or anything like that. So what do I mean by that? I mean like if I have a team that is in
charge of GitLab, I'd rather push the review agent to them because they know
how reviews should be handled. And so there are
there's like this balance of guidelines versus flexibility
that we're trying to build. And I think that's right now
it's starting to stabilize this way. Gotcha. Well, like there's a joint ownership model
in which we own the centralized repository or the registry in a way,
and then people on the skills and they have to adhere to certain
capability guidelines. Yeah, that's
I feel like how it's evolving as well. Do you have anything to help with regards to distribution of either skills
or any other type of agent? Artifacts? Because harnesses have different flavors
sometimes, and where what needs to be before they can be applied in a harness,
which is a whole mess if you want to use, and if you have multiple harnesses
available for people. Adoption is. Adoption is great. Adoption is is the easiest part of
of all of this I revolution. I have to say, like with previous tooling,
adoption was always the biggest challenge. But with AI, people want to consume
more than you want to like have them consuming it. Like,
it's really an interesting experience in that in terms of technical revolution,
everybody that I know in the company just want to use any tool that we produce
and quicker than we can produce them. And I think it's very different
to any other experience I had before. So let's say
you switch to a new build tool. Nobody's like saying, yeah,
yeah, I'll migrate to that build tool. There's always like this relationship
between like, will you migrate? But with these tools it's just incredible. Like everybody in the company, just like
say, do you have an MTV for this? Like they ask us for things way before
we can actually produce those things. And so it's an interesting relationship
where people are actually shaping a roadmap before we even think about it. And I think that's that's one of
the nicest things about this entire, let's say, evolution of the way we do things, because people are actually saying,
this will help me do my job much better. Yeah, so can you. And then we build and then we work
with the team that where we see something needs to be integrated
with or something like that. And then together we come up with like solutions
that for both ownership maintenance. Yeah. From the enable perspective, can the engineers or engineering teams
pick their own harness. Do they have a monthly budget. What are they are and they are choose
picking up their own harness. Yeah. And we are trying to centralize things now
because in our like it we need to be careful. Like because as a large profile I am not a single developer at home. Like my like every little thing that goes wrong is a business mistake. So it has a business implications. So my goal is to my duty
is to make sure that we run as a business. So it has to be balanced with the freedom we give to our engineers, meaning that
we have to centralize certain aspects. And we are working on that
because with enablement, we had a lot of excitement and people
started building their own thing. And so there are aspects in software developer in big corporations
that is called the source compliance. It's very exciting. But basically it's like
you need to be able to show that the changes are being audited
by more than one person. Right? And most people don't understand
that this is part of the harnesses that we are offering.
It just happens automatically. Which is which is what. That's the best. Yeah. That's the best. Yeah. And but they might build tools that go
beyond. Yes. Yeah. They go around those, those. And then we need to to to to stop. That's a risk that I don't want to
have even think about. So I will stop it ahead of time. Do you think it's going to go
in the direction of enterprise harness. There will be an enterprise. Honest. There's already an enterprise
harness forming I think. Yeah, there's a couple people
are trying to be the enterprise harness. I think so, but it's a much
more complicated problem than they think. Like enterprises are hard. Oh for sure. Yeah, yeah, yeah. There's a complexity within it. Again, it's hard to do. There's, there's a difference
between doing compliance for a startup that just starts and doing compliance for a corporation
that is like 30 or 20 years old. And, and enterprises have certain needs that are beyond
a generalized solutions these days. Yeah, yeah, yeah, yeah. What's your thought
on this concept of token maxing? Do people have a budget with regards
to what the no budgets? No. We don't look at token maxing at all. No I find it a bit strange. It is. I feel like I told you this before. I don't understand
why we are pushing people. Like, I am actually pushing my engineers
to be as effective as possible. And I would love an engineer
that makes changes with like, I don't know, maybe five changes a day
with 500 tokens. Like I think for them
it's also a nicer thing to experience. Am talking maxing, in my experience, works
for the first phase of enablement and adoption. And now that kind of all engineers are in the same mind space,
which I want to use it. I am using it. I need this tool. It's like a basic for me. Yeah. Beyond that, I think that's good. We started with the biggest problem
you're solving right now, which is more the verification. It's not just code review, but
it goes into a lot of review of processes and how agents can influence it. One of the biggest problems you've solved already
is more of this measuring of output. And now agents
having been applied on top of that was easy
because you started four years ago. Is there any other problem that you solved
that you're quite happy with that you want to share before we round off? Any other point that we solved? Yes. I think bridging the gap between velocity and experience
is something that we are very proud of. What do you mean by that? So usually when you walk into an enterprise, there's like this gap
between developer velocity and developer experience and misunderstanding
that those are usually the same. So you will get one with the other. And I think that's something
that we've proven to be the case in the last few years. So it is clear that when people have
when engineers have the best experience,
they are also the fastest they can be. And it's like if you go back home
and you work on your side project, you are feeling
the most effective as possible. You can be right. And that's what
that's the exact experience I want to replicate for my engineers,
and I would love for them to be. There's a book called The Sovereign
Individual, which I really like. It's from 97 and they the
they predicted insane things. They predicted the Bitcoin
and the gig economy and a million other things. When did this come out? 97. Wow. Yeah, it's a brilliant book. It's like a Bible for they even now, I think all of this
discussion about like a permanent underclass is coming out of that book,
even because it's basically describing how the technological revolution
moves from countries to individuals. And what implications will
this have on humanity. And the reason is, but it's a really good book to read in terms of like,
how do you empower the individual? And I think we are in a perfect moment
in time to empower the individual to be as effective as they can be, and in a way that is going to be insane in terms of productivity. And our goal is platform engineering teams is to unlock that. And it starts by having them experience the workplace environment
the same way that they experience the psychological environment. Like I want them to feel like
they're running free without concerns while being under like enterprise
harness of some sort. Everything should disappear. I should just be like,
and we have this opportunity right now to do this like, but everything should be
completely seamless for them. What I really love about that
is that this whole kind of a genetic revolution has brought out
the productivity side of things, so engineers need to be more productive,
or we have less engineers because agents can now be more productive. And it's it's quite, yeah, sometimes disappointing or even depressing
to only talk about productivity. But if you say a really good experience
equals high velocity, so high output, high productivity,
then we can flip that around and say we want people
to have the best experience, right. Because if you have a
really good experience, you also have joy. And I do believe that
if you have a fantastic experience, then what you do in productivity increases
automatically. So then that should be the goal. And you definitely have the metrics
to back that up as well. Yeah, it was a theory in the beginning,
but we have the numbers to show that this is the case in course both
experience and systematic measurements. So yeah, it's definitely the case. And you can see it also with like hyper
performance in the industry these days. So like I hope I pronounce his name correctly Peter
Steinberger the guy who behind Open Claw. Yeah. Like you can see that
he's having the best time of his life. Like outputting, like,
you know, one of the pills a day, because fun equals night productivity. Like, you don't feel like you're working. You're just like,
you know, generating outcomes that are aligned with what was like
with what you saw as value before. Yeah. And I think that's where we should
all aim for, like in the single person can do
a lot more these days. And I think if we empower them to do that within the system that we have,
that's the win. Perfect. Yeah. Amos
thanks so much for coming on and sharing. Thank you
Patrick for having me. This was great.
