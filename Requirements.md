We want it so admins can open queues, players will run the /queue command, the bot queues them into their tier (the user has a profile in our DB with a MMR and our db has tier lines. It should just take the command /queue and reply with something like “you have joined the prospect queue” do not give players an option to select) , once enough players are in queue it will create a "match" dm each player with teams -> and if possible (later thing maybe) it will create VC channels for the match (1 lobby, and 2 team vcs). 

Some Notes: 
1. We use MariaDB. But we are maybe thinking of using redis for this endeavor as they have pub/sub support 
2. The queue should never lock itself as people are always queueing (there can be many matches going on at once) 
3. We would also like to prevent back to back rematch of players. It should wait like 3 mins if no one else joins and there would be back to back teams allow it we will never backfill a match. If someone does not show up players should be able to request a cancel where majority of the match needs to agree

Last time we did something like this (players join 1 queue channel and the bot sorts them into a tier we not only crashed the bot we also crashed our DB as we had like 100+ people join at once. So I am very nervous about read and write requests to db).

I would love to make it so that to end the match (if not canceled) a player needs to run a command to end. The command should then popup a model that asks for the tracker url of the match. Only once that is run it should consider the match completed and unlock the players so they may queue again. 

I also forgot to note that it should never auto requeue a player. They have to run /queue everytime to prevent someone player a match then leaving their pc (going afk) 

This system is only used while league_state = combines so this needs to be new I think and not try to use other commands. Ideally self contained. 

Repos: 
Bot Repo: https://github.com/Valorant-Draft-Circuit/vdc-bot 
Database Repo: https://github.com/Valorant-Draft-Circuit/vdc-prisma