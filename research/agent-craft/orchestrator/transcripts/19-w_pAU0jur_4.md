So for as a human you need to run this job 
for 15 minutes. These models only run these jobs for 1 to 2 minutes. That's how much they 
can go and after that they got confused. Their context got spoiled and they stopped. That 
was the problem in 2025. Then everybody like all my friends at research and we looked 
at it and we said you know what this is great and somebody asked me in a conference 
that what I want in 2026 or I want to solve for orchestration I want an orchestration 
that can done do that can do a better job six what is happening is each week or each 
month this 1 minute is getting extended to 16 minutes to 6 hours to 15 hours. That 
means I can take on more and more jobs. Thank you for joining this session is I'm trying 
to give you guys a flavor of hey what it takes to build in this new world and hopefully this 
camera will let me do that. Uh but if not then obviously I think you got an idea. Uh that's 
my main objective today. I will show you how easy it has got to build things and hopefully 
I can build something live today with all of you and take it to production as well not to 
the production that you know 10,000 users can try but I don't know your ideas are so great that 
day one you get 10,000 users I'm trying for last one year Mahes I will talk about three things 
today what are we going to do five minutes over uh who am I a product uh leader that worked 
in big companies, Google, Microsoft, Meta, um in AI for last 10 years. I have built large 
language models. I have built frameworks to build agents and then I have actually shipped agents 
at Google. Uh now I started my own company and uh I'm pretty excited because we signed two new 
customers yesterday. So great job Mah. uh I was going home and I was happy yesterday and I don't 
know why and then I was like okay maybe because we signed two customers and it came after a long time 
and uh both signed yesterday so and by the way in last 6 months we signed two of the customers 
yesterday we signed two so that was a good deal uh but that's what I'm doing these days uh I'm 
trying to see how can we help companies see how they are investing in AI and give transparently 
impact of AI and if there is no impact helping them to bring impact so That's the company I 
started and uh that's what I'm doing these days. But more than anything else, what I'm super proud 
of the work I did in teaching. So I'm teaching for last 14 or 15 years. I used to teach these high 
school students uh at uh East Lake High School and these are CS students and I used to teach them 
the first coding practice. So these are like 9th, 10th, 11th, 12th graders and they used to have a 
lot of fun. You can see the coke coke bottle there and all the fun. Uh but they all learned and they 
cleared the APCS exam. That was my goal with them so that they can get college credits and more than 
that in that school there was no teachers to teach computer science and I always felt that without 
computer science they will lack in their lives. So I did that for four years when I was in Redmond. 
Then I started teaching just free courses in the company. So I did free courses inside Microsoft. 
When I went to Facebook, I created a course with Manoj. Uh Manoj was my engineering manager then 
and he also started a company. He just lives three doors next to me. Uh they are building how can 
they build LLM's uh how can they build video from prompts and optimize that. So he has started his 
own company they got funded $10 million one day that story other day for Manoj but that's manoja 
and me we started a recommendation course inside Facebook and since then I'm trying to teach this 
course in maven in since 2023 I am doing these Friday sessions every Friday and uh we try not to 
sell you expensive courses uh but we will try to at least make sure that uh you have a path to a 
structured learning program as well. But that's the idea and uh that's me. I've worked in large 
companies and I have a passion for teaching. Okay, hopefully that's helpful. If that's helpful, 
then what are we going to do today? Okay, first I will give you general patterns like why 
is building so important in 2026 while it was not important in 2024 or 2025? Why 2026 become the 
year of builders? I will give you trends. I will give you all the insights I have. Then I will 
go and show you how to build a fully functional solution and take it to production in a way that 
at least 10 customers can try. And generally by the way these days we are building lot of custom 
things. So if you can build for one customer I think you can make money. And I will show you how 
to do that. And uh it's simple enough that people who have never coded in their life or don't even 
understand coding, I believe I should be able to take you there. So stay with me. If you are an 
expert, just tolerate me for those 5 10 minutes when I go to basics. But if you are not an expert, 
I think you will enjoy today's session because I tailored it like that. And in a world then once 
you figured out that building is important and then you have the capabilities to build then I 
will give you share share some secrets on what should you build or how can you figure out 
what to build because that is more important than the first two steps. If we agree on that plan 
let's get started. People have their notes. Okay. First thing AI can build but I thought that the 
tech can only predict next work and does not have or can have generic reasoning capabilities that's 
the question you know I got into these debates in these also people challenge me a lot uh and I get 
angry so there are some uh that was the session two days ago but people can ask this question 
right you can have this question which is okay Mah I can understand AI can build people are saying 
AI is writing our code AI is building the whole companies all that but my understanding is these 
transformerbased models can only predict the next word how can AI became so smart or is it so smart 
that it can build a whole app on its own or solve or run companies anybody when I ask questions you 
can answer right do you agree with this first of Do we have better technology than predicting 
next words? Yeah. What has happened? We do right Mah. We have this we have the chain of 
thought and that evolution happened. So this is outdated. Okay. Ram Ram is saying chain 
of thought. Chain of thought is still a next prediction word. So we got next word predictors. 
See I got two markers and both are not working. Yeah. But now they can that's a bad planning. 
Now they can plan too, right? But they became I got next word predictors and they became 
really good. That's the chat GPT in 2023. Okay. Then as Ram is saying we deepseek 
said that hey you know what I also sold lot of things saying that they can't reason. 
La Yakun who was the chief scientist at uh Facebook has a very good talk on uh this 
guy post podcast uh the guy who wears white Russian guy who wears a black suit forgetting 
his name uh and interviews Freedman Alexman Lex Fredman Lex Friedman watch that podcast likun on 
Facebook he talks about how these models are so bad at reasoning and they don't have reasoning 
capabilities or even for a cat how can you think they are smart and he gave lot of good examples 
and that argument is really good we all enjoyed it because that's what I was trying to tell the 
world but the world was not listening likun did a good job and then I have a session where I talk 
about the same things today I'm just not going to talk about I'm going to point you to that but 
then deepse car came and they said you know what we can hack it with chain of thought so instead 
of actually predicting the word that answer your question I can actually create a plan or create 
a chain of thought or chain of reasoning before I go and answer the questions. This is then we 
launch then came the reasoning models remember OPT uh this four O models from CH GPT families 
that was the reasoning model family then we started for some time branches reasoning model or 
non-reasoning model the reasoning model had this chain of thought non-reasoning models don't have 
chain of thought great so now models can think or reason or reason better with a hack which is just 
saying that hey instead of answering the question first come up with a plan to answer a question 
and then follow the plan. Great. Then what is the next bottle link in the world where we want them 
to code like developers and they were not coding in 2023. This is 2023. This is 2024. In 2025 
what was the big challenge? Why can't I code in 2025 with the agents? Multi-step long horizon 
stuff. Long throw all the all the thing throw all the words that were that came to my head like 
throw everything one will stick for sure. Okay, let's write them. What I think answer is correct. 
Uh so uh what what uh multi-step reasoning? So multi-step deduction is still an unsolved problem. 
So you can come up with chain of thought reasoning but following those steps step by step and if 
something fails then creating this plan again or replanning and running these jobs for a long 
amount of time consistently was a challenge. The best in 2025 we can do these chain of thought and 
plan and reason and go through and try again. The jobs these agents could do is one to two minutes 
only. after that their reasoning start breaking and then if the reasoning starts breaking then you 
cannot go and and do the task. So if I go and say, "Hey, make a plan for your uh for your next 
interview and by the way, you can read this Lex Freedman this this and then I go away." You have 
to fill a lot of gaps in your head. You're like, "Okay, I need to go to the podcast. I need to get 
the Lex Freedman one. I need to look at Liakon. By the way, who's likon? The spelling is wrong." So 
because I don't remember how to pronounce these French people. So you know that spelling is wrong. 
So you see that you have filled all the gap in your head and you will keep filling them and that 
will require you good 15 minutes to reach to this likon video just the video and then you have to 
take the insights from it and all that to solve the problem at hand which is reasoning is good 
or not. So for as a human you need to run this job for 15 minutes. These models only run these 
jobs for 1 to 2 minutes. that's how much they can go and after that they got confused their context 
got spoiled and they stopped that was the problem in 2025 then everybody like all my friends at 
research and we looked at it and we said you know what this is great and somebody asked me in 
a conference that what I want in 2026 or this was November somebody said and I said I want to solve 
for orchestration I want an orchestration that can done do that can do a better job than what we have 
today. And in 202 what is happening is each week or each month this 1 minute is getting extended 
to 16 minutes to 6 hours to 15 hours. So now what happens is as an model which can predict next 
word which can plan I can also go and do a job for 15 hours. Yeah you are human you are so cool 
and you have all the connections in your neurons and you are trained on this job so you can do it 
in 15 minutes but give me 15 hours to solve the same problem and I will find different different 
ways. I will fail. I will plan again. I will try again. I will go and do the different things and 
I can do it for 15 hours. That means I can take on more and more jobs or I can do more and more 
jobs. And this is the idea that allows people to say in November that hey actually the humans need 
not to code because in code I can check. I have a verification loop. I write code. Same thing I plan 
I write code if it fails I create a better plan I write again I keep track and I will show you 
that loop when we go today you got an idea how we reached here or what's happening in 2026 six 
which is different than what is 2025 looked like and why people are so worried or excited about 
this I want you to stay both I want you to stay excited about the future we all are going to build 
together but I want to be want you to worry about how much you know or how much you are learning 
every day because there is a lot happening and if you are not learning what is happening I want you 
to be little worried because you know I'm always worried if I'm not learning at the pace that the 
world is moving good then we took this out so this is the idea if you look at this is the chart that 
shows how many hours these models can do I have not looked at 4.7 yet but I will look at 4.7 and 
show you which only got released yesterday but 4.6 Six can do this job at 50% chance of succeeding 
10 hours right here right above 10 hour mark. So it can run the job for 10 hours without you 
doing anything giving it a job and it can do jobs without failing for 10 hours and it has a 
chance of 50% or more succeeding. That's where the compute is. That's why Jensen said yesterday that 
every company revenue is directly proportional to the compute it has. nothing else. If you have 
more compute, you can have more intelligence. If you have more intelligence, you can build more 
products. If you build more products which are high quality, you can have more revenue. And 
he said nobody can stop compute stocks in the markets to stop like growing because every company 
which wants to make revenue will require compute and this is where the compute is. Same page. Red 
Jensen interview he said that yesterday or day before. Okay then what can they do? Anthropic is 
claiming that they build a C compiler a complete C compiler. That's the link you I want you to read 
that. I want you to read OpenAI used codeex to grow agent first codebase and wrote 1 million 
lines of code and I want you to read cursor which ran its background agent. So they build it 
on top of these models just for coding and they run it for 24 hours. So now they can code for 24 
hours with designing building and in those loops. Good. So seems like agents are going to code the 
future of humanity, right? Same page means you can disagree with me. uh but I believe that to be 
true because I've seen it and I will show you okay and hopefully if you follow along you will move 
a little bit towards me then wherever you are in your journey of believing or not believing 
these hypothesis okay then if that's happening then what's happening uh cos are claiming that 
their companies can code this is the number from Google Microsoft saying 30% everybody has to say 
a bigger number in this trajectory to be a bigger company. So Meta is saying 50%. Dario is saying 
90%. And the maker of claude code is saying 100% of claude code team is basically using agents. We 
don't touch the code. Okay. Obviously everybody has their own incentives. Uh what is the reality? 
The reality is around 26 to 27% of the code is written by AI today. But that number was 20% or 
close to 20% last year. That is a huge number if you look at it. Like that means every like we had 
engineers six engineers 1 PM that means at least you can expect two agents coding for you in your 
in your teams this year if they are not doing that somebody else has those two leverage of those 
two developers that code 24 hours 365 days and that's happening in the industry today. Okay, 
what's the distinction? Uh, AI assisted code, AI generated code and AI building the code 
on its own are the three different things that people have products for and they are not 
equal and I will show you some example of these. Great. Then how teams are expected to 
collapse? What will happen in this new world? uh AI is not replacing engineers. It's very hard 
for me to replace my engineers. I have at this point 10 engineers working for us and it's they 
are irreplaceable. But actually the senior people are really irreplaceable. The juniors are a little 
more pain to work with these days because the more amount that I need to spend training them and then 
I have to deal with their vocations and everything uh it's much less leverage for me than the AI 
agent that we are building. And if I give the senior person an AI agent and train them how to 
use them, I get more buck or more value from my money than training the juniors. So that's a 
clear thing that I have practiced or seen. U there are two new roles you can think of. One is 
this idea of product engineering. So more and more people are trying to collapse the field of product 
engineering. So engineers are learning how to what to build, how to talk to customers. If you talk 
about this guy who said 100% the code, right? So Churnney, right? The guy who made uh claude code 
he I think some podcast people were saying okay if AI writes 100% of code what are you doing and 
he said I talk to customers and I figure out what to build next and I was like yeah sure that was 
our job so uh so then that's what engineers are trying to get into product and product managers 
are trying to get into engineering and that field is collapsing that I think is a good new role 
that you should all train for if you are going to be here or or if you're growing to grow okay 
then what is the impact on jobs only 60% product managers are more excited founders are the most 
excited people about AI of course because they see that now they can build things they have ideas 
and they can build and they can shout at people much louder than they could yesterday of course 
they are the most excited people the second most excited people are you folks uh that's why maven 
as number one following on PMs. Most marketing happens on PMs because they are most excited about 
AI because this is the first time they feel like they have an agency. They can go do things which 
they were always dependent on others to build it for them. They have ideas. They have the first 
insights into what the world is looking for, how the world works. They have a better model than 
an engineer or a designer in my own perspective. And now you give them tools. That's why they are 
saying that my life is better with AI than same. Engineers are a little worried. Designers are less 
little less worried. So in between the spectrum and that's happening. Okay. If that's happening 
then this is the survey. Uh Lenny did it. I'm just using it and you will see me using everybody's 
survey most of the time because I try to build things and I don't get time to do surveys. uh uh 
more PM jobs than less PM jobs. At least in the first phase of this wave uh we are seeing all the 
positive signs that people are getting paid more, people are getting more roles and at least in last 
16 months what I have seen is most people are able to find roles that they are interested in or they 
want to break into. It doesn't happen in 6 weeks. It takes six months to a year cycle but people 
are getting calls people are the positive sign I see in a job market is when you are getting 
interviews and I get lot of calls saying hey I have an interview I have this case study I 
have this case study I have an interview after that it's more like subjective journey and that 
takes a while okay engineering is also evolving people are going PM is going from spec writer 
to constitution writer to agent orchestrator. Engineers are going from codewriter to evaluators 
to agent directors. So you will orchestrate agent and they will make sure that these agents do a 
perfect job and then the movie will be created. So imagine you as a writer of the movie and 
they are the director of the movie. Good. And you should understand how to orchestrate 
these agents and hopefully we can do that next. How can you build anything without knowing how 
to code? That's the most exciting part of this session. So if you got excited or at least you 
understood a little bit in the first section, let's get to it. Let's spend 10 or 15 minutes. 
Two or three two or three things you need to understand when you come to building. I have 
this lab which I will walk you through on board and then I will show you how can you do 
this and we'll give you the resources so you can follow along also. Okay, I want to build. I 
am a PM. I know basics, but I stopped coding 10 years ago. I have not coded anything since then. 
How can I be successful in this new world? Okay, first learn some basics if you want to code. 
Four things. Uh what is front end, back end? Can everybody understand front end back end? Give 
me a hand hands up if you understand what is front end, what is back end of an app. Okay, Ram, Sema, 
Derek, anybody who has not done our course, give me a hands up if you understand for front end, 
back end. Okay, most of you understand front end, back end. Okay, give me an example of front end, 
back end that any 5-year-old can understand front end and back end. Brenda, you don't give. 
Somebody from the cohort give. Let's let's pick on them because they sound like they have a 
lot of questions. When you get into 15 minutes, they ask very hard questions. Restaurant. Come on. 
Come on. Come on. Come on. Come on. Come on. Raise her hand. Restaurant and kitchen. Kitchen is where 
you make the recipe and restaurant is where you go and sit. So, this is the waiter and this is where 
uh our friends are sitting and this is the front end. And this is the messy kitchen. 20 people 
working, sweating, uh cooking, there is fire here, all this is back end. We draw a wall and then we 
show all the pretty things here, all the things here. And behind the scenes, we have all the 
messy code, everything which doesn't work. Or if we have to scale, we can say, okay, this guy 
is just cut the vegetables. These are only cook, these are only going to serve or check. These 
are my checks or tests. And then here is my final final garnishing. And then here is my chef looking 
at it. And then I can make a contract which I can say uh application programming interface which 
is my interface with the front end. So front end just talks to me which is this table we have put 
up and I put my dishes here and on top of the bill and then this front end can come in. This is my 
waiter which is front end. It looks at the order bill and if there is a plate it picks up and on 
the order it return which plate and kamill gets chole. Good. I think we all got it. So that's the 
back end. The back end idea is that anything that needs to scale or needs to do the real work can be 
in back end. The front end idea is that anything that customer need to look feel do remains in 
front end. If you take the analogy and actually start building Facebook page that you look at or 
the app all that is front end behind the scenes there are models running there is data capture 
there is authentication happening there is this uh idea of tests on the next build all this 
is the backend functions okay there's one last thing in understanding coding there is a front end 
there's back end there are two different engineers different technologies for front end and back 
end and don't need to get into detail because agents will figure that out but to prompt them you 
need to understand these two concept what is front end what is back end okay if you understood 
front end and back end there's one more idea which is this idea of the bill the transaction 
that happen if I want to audit this restaurant or if I want to do accounting on this restaurant 
I have to store all the receipts and the things. That's the idea of a database in this restaurant. 
This square thing where you order creates the transactions which is like hey this order was 
placed. This was the server. This was the time it took to cook the dish. This was the feedback 
from Kamill Pi star. All that is getting stored somewhere. Right? So end of month as a restaurant 
operator I can go and say how much money I made, which customers gave me one rating, who is 
my bad server so that I can fire some people, who are my awesome servers, who I can give more 
money. All these needs to be stored somewhere and that table storage is called databases. And the 
language like I go and I query things. Same way there is a query language called standard query 
language which you use to query these databases about hey how many servers I have how many servers 
were on holidays this month all this is a standard query language so remember three things front end 
back end databases and a language to query it good there is language in which you can write front 
end and back end that language can be both Python So, Python is a coding language. You can 
write your front end and back end code. Plus, if you understand SQL, you have a killer profile. 
Just knowing this, you have a killer profile. Now, you can use any AI tool to code for you. Good. 
Everybody same page. Front end, back end, and SQL. Good. Databases and SQL. This is pretty 
much all you need to learn in 2026 about coding. This is all the engineering you need to do. 
Rest everything agents will take care of. Okay. If you understood this much, let's take 
on building. Uh park your questions. I will take questions in 10 minutes. Just give me 10 
minutes. Let me build something and share some ideas on what you actually need to go build 
and then I'm all yours to own questions. Put your questions on Scrumbler. Okay, great. Now I 
am talking to a company and created this PD for myself. P is product requirement document. 
These PMs who have nothing else to do in their lives. Those who have nothing like they 
don't have a love for their kids. They go out in the world. They look for problems and then 
write it in some product requirement document called PR. So here's a problem. There is an 
interesting thing about FRS16 compliance. What is this compliance about? Uh there is 
this compliance. I was talking to one of our customers and they told me about this compliance 
called IFRS16 audit. Uh this is a compliance that uh anybody from finance background IFRS what 
is it? Anybody? Mahes international financial reporting standards. Great. And uh what is the 
reporting? Why it is a mandatory requirement now? the 16 specifically. Oh, I don't know the 16 one. 
Great. Uh, let me let me give you this. So, what happened is if you were reporting your numbers 
and if you bought a plane, if I bought a plane, which I want to buy, by the way, I never wanted to 
buy a fancy car. I wanted to buy a plane. So, all of you please pay me a lot of money, which Marvel 
said I'm really good at. But, by the way, we don't sell our courses in this Friday session. So uh the 
idea is that if I bought a plane then uh my plane will be uh as a depth in my reporting. Great. But 
if I went before IFRS 16 which is a very recent update in the financial reporting code if I leased 
the plane then I need not to report that death. So what companies did they took lot of things on 
leases the whole company was running on leases. So that they need not to report any debt and if 
you look at their balance statement everybody is looking so positive everything is healthy they 
had no debt but everything was in leases okay then they updated if 16 which says that hey you need to 
go and report everything that you have leased and what you owe month and month and what is that what 
is the impact of that on your balance sheets or on your profit loss. Great. Every audit requirement 
put lot of pressure on every company. The problem is there are only five bad 5% bad actors in 
economy. 95% people were playing fit fair but they have leases now. So I'm talking to a lot of 
real estate customers who are leasing buildings and now they have to comply to this IFRS6. They 
have to create this whole sheet. Everything they have in their lease, they have to put it into 
this format and submit it monthly reporting or quarterly reporting. So they have to do all 
this reporting which is a hard job. Rachel is a compliance lead. She got this new requirement. 
Nobody's giving her an extra head. General council also need to go and make sure that all these risks 
and the tools we use are good and senior associate wants to get done. The job to be done here is that 
IRF 16 deadline approaches. I want to generate a s structured compliance report directly from 
our contract repository. So I can submit an audit ready output to our external customer. When 
the auditor asks for a source clause behind subsc frame 60 days post launch I have created some 
success metrics I have requirements good all of you can write these by the way AI writes 
these also so you can ask AI to write this use my format and AI will create this document for 
you for any problem that you are facing. facing in your life or any problem your customers are 
facing. So you go talk to a customer, you write, you take the meeting notes, you put it a prompt 
saying, "Hey, create a P in this format that Mah gave me and you will have a problem and a P." 
Great. Once you have a P then what you can do is you can put it in a folder. Uh let me show you. 
So what you do is you create this project folder. So I created this project folder and inside 
project I have created this PRD folder and I put this lease here. Okay. So this PRD lease 
compliance folder is here. It's inside my folder. Then I go to claude code. Everybody know what 
claude code is. You can install this claude app on your desktop. If you install this then you can 
go here and you can select claude code or you can select co-work. I am selecting plot code today. So 
you can go here and if you paid them lot of money, everybody wants money except us, right? But if you 
paid them $20, you can sign into this app. This is claude app. And then you can switch from co-work 
to claude code. Here if you go to claude code, it asks you to give you or connect yourself to a 
folder. And what I have done is I have gone ahead and created added that folder here. Right? So all 
I have to do is point it to my P folder and then it was done. Then I can it get my context which 
is the P. Then I have my prompts. Those are very simple prompts. I just wrote them for all of you. 
So you can follow along but and we will give you them also. So you will have the copy of these 
prompts. So these are my prompts. I will just prompt them and build the front end here. What is 
front end? The thing that you will look and feel and see. Good. So, first step is creating a front 
end of the app. You as a product manager always relied on designers to create it. Now, you can 
create it on your own. That's why the designer is a little more worried than you. They are not 
that excited than you are. So, you can create a prompt. You can say, "Hey, here's an attached P. 
build a consulate just the mocks for me. These are my requirements. I have written everything down in 
the PD. I need runnable mock and short explanation on key parts. Great if you can do that. So you 
come here, you gave your context and that's all you need to tell it. notif6. I just copy here and 
I can copy this prompt from here to here or I can just say these things. I can just talk loud to the 
model and it will do it. And that's it. It will take my PD and it will start creating my front-end 
mocks. Once the mocks are ready, what you will do is you will go and create the real code. you will 
say hey I got it now this superbase thing what is this superbase this is the database you remember 
that that thing where we store all the tables and everything the database so now I will say hey 
let's create a real app and I will go and create a real app and I will just write this prompt which 
says hey take these mocks or these designs and now go and create a complete mock for myself. It comes 
back and says, "Hey, I have a goal. The prototype your previous lesson already exist. Of course, 
I tried it before. So, it has found also it is trying to become smart. This file covers a lot 
of P 0. Would you like to preview the existing prototype to verify matches extended to something 
new? Start fresh with redesign." I will say three. I'm starting fresh. It also find out that I did 
the same thing yesterday. So it is saying hey who already used your tokens take them but I'm saying 
let's start from fresh so that all the PMs can follow along. So just copy this prompt right now 
in cloud and you will get your mocks. It will not be a fully functional back end. It's just the 
front end right now. And with this prompt you will be able to create the whole front end. Your 
kitchen will be ready. I can place orders and they will get some kind of dummy food. So Kamill will 
get like a plate and there will be a dummy chatura on it but she can't eat it. It will be the same 
and if she eats it it's just made up of plastic. Okay, those are called mocks. So our goal is like 
hey we can go in and create the mocks first and we can iterate on the first front end right is our 
restaurant ready are the tables looking good? Is this our menu? Everything we can create the whole 
front end first. Good. So that's the first part. Then for the back end, now your problem is how 
can I create this in the back end? It's very sophisticated. I need an agent. The agent need 
to look at a lease document, extract the content on it, put what the lease do terms are, and then 
create a report that we can fill to compliance. Good. For that, the tool I'm going to use is this 
tool called N8N. Everybody know about N8N. If you don't know about NAT, we will give you a training 
team. Our team, can somebody put the link in the summary to getting started on NAN guide? See, 
I'm super cool. I have superpowers. I just say that and it will happen. Let's see. Maybe one day 
agents. But can we put a link on summary slide which takes us to our getting started on NA10 
guide? Okay. In this NA10 you can create flows. So what you can do is you can create agents. So 
I will create an agent and I can connect it to a model. So all I do is I click the plus sign. So 
now I'm creating the back end. This is the messy kitchen that we have. And I can just select an 
agent and I can say hey agent here is your open AI chat model. I can give it a machine learning 
model to do all the thinking for me or doing all the all the cool stuff and it's ready to go. I can 
connect memory and tools to it and I can connect more agents to it. In this one, I can write what 
I want it to do. So, I can come here. I can or add a option and I can write a system message that 
your job is to take a contract a lease contract. Take a lease contract and 
generate the data needed. generate the data needed to fill the to fill RS 16 form. Good. So I have given it uh 
some basic instructions by the way while I'm doing this. So this is ready and if you can create this 
then you can also connect other agents to it. So this is my first agent. I can create even more 
agents and connect this as a tool. So then I can create more complex workflows like this one. So 
I created the first agent, I connected it to my model. So this agent just does an orchestration 
or plans. This agent actually goes and finds what I need to extract from the lease or 
even an NDA or a master service agreement. And this one actually goes and extract those 
values and then it will respond. These two web hooks are important. That's this piece, the API 
piece. So I can go and write and chat with this air. But I want it to respond to this front end, 
right? This back end should talk to this front end. Remember that table and that transaction 
that handshake. This web hook is a handshake. This is the address that you need to tell your 
front end folks these guys that hey when actually Kamill wants the cholawa they are here right this 
is the bill which you need to get it from. So you need to copy this and that I will show you in 
the next prompt. How can you connect your this back end in nan to your front end which you have 
created here. By the way while I was talking to you my whole app is ready. So I can see that my 
app is here and it's ready to go. But these are only mocks. This is only front end. It doesn't 
read anything. It will give me some dummy data. But it is ready. I can actually look and feel. I 
can talk to customers. I can show them that this is how it would look. So this shows me that 
these are all the properties I have rented. These are the assets. These are my monthly. This 
is my AI confidence on extracting these terms. This is what is needed to report to IFRS16. 
When is this commencement? What is the lease term? What is the renewal options? So, it has 
extracted all these things and I can export them to PDF for filing. Good. So, my basic 
app is ready in 10 minutes and I can go and do stuff. I can also upload a new contract 
and get new stuff if I want to. So, I can just try it and make you feel like I have built 
something. So if I go here, I can take a lease. You can see a lot of my compliance document 
because I'm filing my taxes. So you can put a contract like this or you can put actually 
a lease. So I'm just going to put a and then you can click a button. Although I put an NDA, it 
shows you and it says extraction failed. We could not process. It may be scanned image or text. It 
is not a machine readable. So right now it has lot of problems because it's just a mock. Great. How 
can we make it work? We have to connect it to back end where we have touched lot of things and we 
have built the whole thing in the back end where we have the logic to extract the file from PDF. 
We have agents which can parse this information. We have agents which can find what needs to be 
extracted from this contract and also extract it and send it back. Good. So we have return 
everything we want to say here and this app needs to do. Good. So the next prompt what you do is you 
copy this from here. This web hook you copy this address and let's just update this app. So now 
what you do is you go you have a prompt you can give prompt number two but in prompt number three 
you see this address send web hook integration send post request to the following web hook URL 
okay I can go and set it for this web hook URL and give this prompt and that's it and that will 
connect your back end to front end and now both can talk to each other so I have already done 
that yesterday. All you have to do is just pass these three prompts. The fourth prompt is just a 
good front- end table output. But three prompts is all you need. The first one creates the mocks. 
The second one creates the UI and starts storing information in a database. And the third one 
actually connects the back end to front end. Good. So now I have created this whole tool with 
these three prompts. You can see my journey. I'm happy to share the whole journey. So first prompt 
gave me what you got. This is my second prompt. I got the database. I got everything ready. Third 
prompt I go went ahead and integrated with my back end. And let me show you how it works. So 
I can go to this one and I can come in and say preview. This is my app. And when I run this 
one, it will go and talk to my back end also. Okay. So I can come here. This is 
my back end in N8. And I can just for testing purpose I can just go and 
say hey my back end execute workflow. And that's it. So this back end is now ready. 
Waiting for a front end to come in. I can go and add contract. Oh really? This one. So 
this one I also published it. So I went ahead and said hey you know what let's just go 
lease compliance. I have published it here. So also you can go and use netly plug-in. So 
in this one I create it and then I go and publish it. So all of it you can also use 
it. So this is a fully functional website. Now I have went ahead and published it also and 
I will show you when I call this one how it calls my workflow which is right here. Good. And you 
can get this link. I can just you can also try it while I'm trying it. But let me try first and 
then I give you the fun stuff to go do yourself. So I have published this app and this app can 
now go and talk to my front end and if I take a contract let's take an loan agreement 
or an NDA. Okay, I take this DX or let's just take something simple which we can process 
faster. There was one which I tried yesterday. because I'm running short on time. Where 
is this gone? Let's try this one. Let's see if this works. Okay, you open it. You're 
waiting here and I when I press the button, you see that I can also parse it. I can see it 
on my front end the document. I can read it. Last time I was saying I can't read it, but now after 
third prompt, I can read it and I can say extract key terms and I can analyze contract. when I 
it says network core server I say retry same error because I I forgot to say execute workflow 
here so now I'm waiting and let's try one more time great now you see it started working the 
code is here it's working on the orchestration layer you can see I got the same dx andda and 
we got problem key extraction agent no prompt specified so this somehow we deleted something 
I have the prompt let's try one more time so you can say analyze contract one more time and you 
will start getting and now I have to say execute workflow once you test it you can just publish it 
so you need not to press this button every time but this is for testing I wanted to show you live 
but once you have tested it you can just click the button and it will go here it will analyze 
things it will extract terms it will extract key terms now and you will see a response here 
in few seconds. Okay. Then you can see that all this thing you can build workflow executed. I 
got my results that came from it. You can keep trying that. You can try a lease contract. You 
can try different things. You can keep changing your playbooks also. So this is where what you 
want to extract from these contracts. You can change that here and it will do the work. All this 
can be built in 30 minutes to 1 hour. Obviously, it might take me 3 hours, 4 hours before, but you 
can build something like this without knowing how to code is the idea. Okay. Then if all of you 
can do that, then what is left in this world for you. Okay. So, we can build the front 
ends in cloud code. We can build the back end in NAN and we can marry them together. 
That's the lab I tried to show you today. Then I wanted to talk about these frameworks but I 
don't have time. So maybe you want to do my course or maybe you want to do our course where we talk 
about these ideas. But let me give you one idea which is this idea that hey this is the cost of 
error. So you want to see the co the jobs where the cost of error is low and type of knowledge 
needed is explicit. to have this information what the compliance need what the compliance 
requirements are when a good or bad document looks like you have a good standard and if the cost 
of error of producing something like that is low you want to automate those things first so this 
quadrant you want to go after first then you can choose between this or that I generally go here or 
you can go here where you have like cost of error is low but tactical information and this is where 
most of the humans should live or You should try moving to the jobs where the cost of error is high 
and you need more tactical or explicit implicit uh tactical information to solve problems. Good. 
This is another framework which I will talk next time. Hopefully this session was useful. The idea 
was that how can what is the current state of the world? I tried to explain it to you which is like 
why these agents have become so good. what are the underneath technologies? Then I shared you how can 
you actually go and build stuff in cloud code for front end connected to an NA10 back end. I will 
explain you why I chose NA10 for back end while I could have done everything in cloud code. why 
I still prefer that I can answer that question if you have and then I didn't spend too much time 
on this which is what can you build but I wanted to land the idea that building is not that hard 
and with simple three or four prompts and a PD you can actually create working mocks and if you 
have working mocks you can take them to production if you want to take this setup to production 
all you have to do is go to your NA10 flow and then just set it up once you tested it it started 
working for you. You can go and say publish and once you publish then you need not to press this 
button every time this execute workflow. Now it is published and now all of you with that link 
I shared and here after the four steps all you have to do is go to customize connect and do this 
netifi connect. So netifi is a third party service which allowed you to take the code you have on 
your machine. So this front end is on our machine right I want to put it on some cloud where all of 
you can access or this website. So you can go to netleifi connect it and just write a simple prompt 
say hey publish my front end app to production use netlei connector and that is it. It will go and 
publish this and give you a URL which I had which I used here. And now you can give this link to 
your customers, to your friends, to your family and they can actually try your stuff, start giving 
you feedback. That's all I had for today. I will take two questions from here and then I will take 
all the questions from scrum for next 15 minutes and I will give you two or three things to take 
away. One is building code is a solved problem or is getting to be a solved problem by the end 
of 2026. So try building stuff every day and you will see where we are and you will be able to move 
it. While you do that, take on courses on basic, how to use cloud code, how to basic cloud coder 
and cloud code has a good course uh on their website which is I think building with cloud 
code. So take that course and start building on cloud code these front- end things. Take a course 
which is also open how to build agents on nan and if you get stuck obviously join our course which 
we are not trying to sell here. uh and uh then I will say create a community around you if you can 
uh which helps you when you get stuck. The most people drop from this building line when they try 
to do something and it fails and then they don't know how much time it will take to fix it. It is a 
journey. take it like a journey and try to create your community where people can help you at least 
get out of that blocker you have in like 24 to 48 hours and that's what I think you should pay for 
and don't pay for basic building but pay for that community and that support and if nobody provides 
you that support then uh you know don't pay for it rest everything you should be able to do on your 
own uh why build as a PM uh I think it's just so much empowerment now that you can gain and so much 
leverage you have in next 5 years if you can code basic back end and front end stuff and connect 
them because you can go to customers and while they are talking to you or within 3 to four hours 
you can go and show them a working sample that is the superpower I always had and now all of you can 
have it and that single thing is I think the job security the uh income multiplier where the life 
satisfaction all that will come from that single thing which is I can create a front end I can 
connect it to back end and I can show something working to customers within like four five hours 
great uh if you if I know I know I know I'm over time today uh last thing I would land is uh that 
if you are interested we have started our substack channel where we will be sharing how to do this 
lab step by step and if you have not signed up for that please sign up for that. Uh the substack 
link is right here because my team is telling talk about substack at least. So this is our substack 
and if you have not signed up please sign up for our substack it's a very nominal annual fees and 
for first I think if you're part of this community you will get links to this substack. Anyways, if 
you have not signed up, please sign up for our substack that will allow you to get access to all 
the labs that we release every week and all the material we do and also give you access to papers 
and give you access to our job portal. With that said, here is our YouTube channel and here is our 
course and we are giving two courses for one and you can subscribe to get loaded. uh we are going 
to remove if you have subscribed it if you're not part of our substack we are going to remove this 
channel if you signed up to for all Friday free sessions and we send you invites that is going 
to stop if you are not signed up for our substack so that's the last thing I want to land here is 
our free sessions this is substack this is slack YouTube next role and nobody gave a link to claude 
code or uh the nit tutorial so maybe I can do that when done or that will be part of our substack 
newsletter. Okay team, thank you for staying back. It's always fun to see all of you. I will 
see you next Friday. Till then, bye. Take care.
