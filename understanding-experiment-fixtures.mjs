// Synthetic test cases, NOT Tavily results or proof of real-world opportunity rules.
// These are deliberate traps based on past mistakes; source IDs are local fixture IDs.
export const scenarios=[
 {name:"YouTube automation",round:1,evidence:[
 {id:"y1",field:"device",excerpt:"A smartphone can be used to create and upload videos; a laptop is optional."},
 {id:"y2",field:"kyc",excerpt:"Identity verification is required at the monetization/payment stage, not to create a channel."},
 {id:"y3",field:"startingCost",excerpt:"A $100 coaching course is optional; no mandatory signup fee is established."}],
 expectations:{device:"phone is an option; laptop not mandatory",kyc:"payment-stage ID is not a start blocker",startingCost:"optional $100 course is not a required starting fee"}},
 {name:"YouTube automation",round:2,evidence:[
 {id:"y4",field:"nigeriaAccess",excerpt:"A page about Niger lists Nigerien IDs. It does not establish Nigerian rules."},
 {id:"y5",field:"earnings",excerpt:"A creator reports earning $500. This anecdote is not typical beginner income."},
 {id:"y6",field:"withdrawal",excerpt:"A US payment example cites $100; Nigerian payout threshold is not established here."}],
 expectations:{nigeriaAccess:"Niger is not Nigeria",earnings:"anecdote not typical earnings",withdrawal:"US threshold not Nigerian threshold"}},
 {name:"Forex trading",round:1,evidence:[
 {id:"f1",field:"startingCost",excerpt:"Broker A advertises a $10 deposit; this is a deposit with a particular broker, not a universal mandatory forex trading fee."},
 {id:"f2",field:"legitimacy",excerpt:"Forex currency markets exist, but that does not prove Broker A is licensed or trustworthy."},
 {id:"f3",field:"earnings",excerpt:"A promoter promises guaranteed 20% returns. The excerpt provides no verified basis for the promise."}],
 expectations:{startingCost:"broker-specific deposit not universal fee",legitimacy:"market existence not broker verification",earnings:"no guaranteed return"}},
 {name:"Forex trading",round:2,evidence:[
 {id:"f4",field:"nigeriaAccess",excerpt:"Broker B's page describes availability in Kenya, not Nigeria."},
 {id:"f5",field:"device",excerpt:"A mobile app supports basic trading; advanced desktop charting is optional."},
 {id:"f6",field:"withdrawal",excerpt:"A broker advertises bank transfer withdrawals but gives no Nigerian processing time."}],
 expectations:{nigeriaAccess:"Kenya is not Nigerian eligibility",device:"desktop optional",withdrawal:"method known, Nigerian timing unknown"}}
];
