var path = require("path");
var express = require("express");
var bodyParser = require("body-parser");
var mongodb = require("mongodb");
var cors = require('cors');
var therapist_service = require("./therapist_service.js");
var ObjectID = mongodb.ObjectID;

var THERAPISTS_COLLECTION = "therapists";
var USER_ANSWERS_COLLECTION = "useranswers";

var app = express(); 

//checks if the environmentl is dev or not to determine if https will be used as to prevent colision with localhost
// if(process.env.npm_lifecycle_event != 'dev'){
//     app.use(function(req, res, next){

//         if(req.header('x-forwarded-proto') !== 'https'){
//             res.redirect('https://' + req.header('host') + req.url);
//             // console.log(req.header('host'))
//         }else{
//             next();
//         }
//     })
// }

app.use(bodyParser.json());
app.use(cors());
app.use(express.static('frontend'));

// Create a database variable outside of the database connection callback to reuse the connection pool in your app.
var db;

//  TODO: All routes referencing 'home.html' must be changed to '/' across all .html files.
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend/home.html"));
})

app.get("/imdframe", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend/iframe.html"));
})

// Connect to the database before starting the application server.
mongodb.MongoClient.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/test", function (err, client) {
    if (err) {
        console.log(err);
        process.exit(1);
    }

    // Save database object from the callback for reuse.
    db = client.db();
    console.log("Database connection ready");

    // Initialize the app.
    var server = app.listen(process.env.PORT || 8080, function () {
        var port = server.address().port;
        console.log("App now running on port", port);
    });
});

// CONTACTS API ROUTES BELOW

// Generic error handler used by all endpoints.
function handleError(res, reason, message, code) {
    console.log("ERROR: " + reason);
    res.status(code || 500).json({"error": message});
}

app.get("/", function (req, res) {
    res.sendfile('./frontend/' + 'home.html');
});

// app.all('*',function(req,res,next){
//     if (req.headers['x-forwarded-proto'] !== 'https') {
//           console.log("*******************   req get host   " + req.get('Host'));
//            console.log("*******************   req get url" + req.url);
//           return res.redirect(301, 'https://' + req.get('Host')+ req.url);
//     }

//     return next();
// });

app.get("/api/therapists", function (req, res) {
    db.collection(THERAPISTS_COLLECTION).find({}).toArray(function (err, docs) {
        if (err) {
            handleError(res, err.message, "Failed to get therapists.");
        } else {
            res.status(200).json(docs);
        }
    });
});

app.post("/api/therapists", function (req, res) {
    var newContact = req.body;
    newContact.createDate = new Date();

    if (!req.body.name) {
        handleError(res, "Invalid user input", "Must provide a name.", 400);
    }

    db.collection(THERAPISTS_COLLECTION).insertOne(newContact, function (err, doc) {
        if (err) {
            handleError(res, err.message, "Failed to create new contact.");
        } else {
            res.status(201).json(doc.ops[0]);
        }
    });
});

/*
Note: Uncomment this for when a use case for this route arises.
app.get("/api/answers", function (req, res) {
    db.collection(USER_ANSWERS_COLLECTION).find({}).toArray(function (err, docs) {
        if (err) {
            handleError(res, err.message, "Failed to get answers.");
        } else {
            res.status(200).json(docs);
        }
    });
});
*/

app.post("/api/answers", function (req, res) {

    //  Note: When user clicks "Skip questions" for income the input value is 'on'
    //  TODO: Set input values to null when user clicks "Skip Question"
    var details = {
        insurance: req.body.insurance,
        income: req.body.income != 'on' ? req.body.income : null,
        student: req.body.institution === "UOFT Undergrad" || req.body.institution === "UOFT Graduate" || req.body.institution === "UTM Graduate" || req.body.institution === "UTM Undergrad" || req.body.institution === "RYE" ? req.body.institution : null,
        creationDate: new Date()
    }

    db.collection(USER_ANSWERS_COLLECTION).insertOne(details, function (err, doc) {
        if (err) {
            handleError(res, err.message, "Failed to submit answer.");
        } else {
            res.status(201).json(doc.ops[0]);
        }
    });
});

/*  "/api/therapists/:id"
 *    GET: find contact by id
 *    PUT: update contact by id
 *    DELETE: deletes contact by id
 */

app.get("/api/therapists/:id", function (req, res) {
    db.collection(THERAPISTS_COLLECTION).findOne({_id: new ObjectID(req.params.id)}, function (err, doc) {
        if (err) {
            handleError(res, err.message, "Failed to get therapist");
        } else {
            res.status(200).json(doc);
        }
    });
});

app.put("/api/therapists/:id", function (req, res) {
    var updateDoc = req.body;
    delete updateDoc._id;

    db.collection(THERAPISTS_COLLECTION).updateOne({_id: new ObjectID(req.params.id)}, updateDoc, function (err, doc) {
        if (err) {
            handleError(res, err.message, "Failed to update therapist");
        } else {
            updateDoc._id = req.params.id;
            res.status(200).json(updateDoc);
        }
    });
});

app.delete("/api/therapists/:id", function (req, res) {
    db.collection(THERAPISTS_COLLECTION).deleteOne({_id: new ObjectID(req.params.id)}, function (err, result) {
        if (err) {
            handleError(res, err.message, "Failed to delete therapist");
        } else {
            res.status(200).json(req.params.id);
        }
    });
});
//TODO:
//find a way to do a mongodb query using JSON objects (i.e. give .find a JSON object);
// 'cause the current query is very verbose!
//Retrieve therapisits from the DB that match user's preferences
app.post("/api/match", function (req, res) {

    //Gender
    gender = ["Male", "Female"]
    if (req.body.hasOwnProperty("gender") && req.body.gender == "Male") {
        gender = ["Male"]
    }
    else if (req.body.hasOwnProperty("gender") && req.body.gender == "Female") {
        gender = ["Female"]
    }
    //Language
    lang = ["English", "French", "Arabic", "Urdu", "Hindi"]
    if (req.body.hasOwnProperty("lang") && req.body.lang == "English") {
        lang = ["English"]
    }
    else if (req.body.hasOwnProperty("lang") && req.body.lang == "French") {
        lang = ["French"]
    }
    else if (req.body.hasOwnProperty("lang") && req.body.lang == "Arabic") {
        lang = ["Arabic"]
    }
    else if (req.body.hasOwnProperty("lang") && req.body.lang == "Urdu") {
        lang = ["Urdu"]
    }
    else if (req.body.hasOwnProperty("lang") && req.body.lang == "Hindi") {
        lang = ["Hindi"]
    }
    //Religion
    religion = ["Christian", "Muslim", "Jewish", "Spiritual", "Not Religious"]
    if (req.body.hasOwnProperty("religion") && req.body.religion == "Christian") {
        religion = ["Christian"]
    }
    else if (req.body.hasOwnProperty("religion") && req.body.religion == "Muslim") {
        religion = ["Muslim"]
    }
    else if (req.body.hasOwnProperty("religion") && req.body.religion == "Jewish") {
        religion = ["Jewish"]
    }
    else if (req.body.hasOwnProperty("religion") && req.body.religion == "Spiritual") {
        religion = ["Spiritual"]
    }
    else if (req.body.hasOwnProperty("religion") && req.body.religion == "Not Religious") {
        religion = ["Not Religious"]
    }
    //Student
    student = ["yes", "no", "skip"]
    if (req.body.hasOwnProperty("student") && req.body.student == "yes") {
        student = ["yes"]
    }
    else if (req.body.hasOwnProperty("student") && req.body.religion == "no") {
        student = ["no"]
    }
    else if (req.body.hasOwnProperty("student") && req.body.religion == "skip") {
        student = ["skip"]
    }

    //Income
    income = ["<$40,000", "$40,000-$60,000", "$60,000-$100,000", "$100,000+"]
    if (req.body.hasOwnProperty("income") && req.body.income == "<$40,000") {
        income = ["<$40,000"]
    }
    else if (req.body.hasOwnProperty("income") && req.body.income == "$40,000-$60,000") {
        income = ["$40,000-$60,000"]
    }
    else if (req.body.hasOwnProperty("income") && req.body.income == "$60,000-$100,000") {
        income = ["$60,000-$100,000"]
    }
    else if (req.body.hasOwnProperty("income") && req.body.income == "$100,000+") {
        income = ["$100,000+"]
    }
    //Age group
    agegroup = ["<13", "13-17", "18-29", "30-39", "40-49", "50+"]
    if (req.body.hasOwnProperty("agegroup") && req.body.agegroup == "<13") {
        agegroup = ["<13"]
    }
    else if (req.body.hasOwnProperty("agegroup") && req.body.agegroup == "13-17") {
        agegroup = ["13-17"]
    }
    else if (req.body.hasOwnProperty("agegroup") && req.body.agegroup == "18-29") {
        agegroup = ["18-29"]
    }
    else if (req.body.hasOwnProperty("agegroup") && req.body.agegroup == "30-39") {
        agegroup = ["30-39"]
    }
    else if (req.body.hasOwnProperty("agegroup") && req.body.agegroup == "40-49") {
        agegroup = ["40-49"]
    }
    else if (req.body.hasOwnProperty("agegroup") && req.body.agegroup == "50+") {
        agegroup = ["50+"]
    }
    //Booking time
    booking = ["UTM", "UOFT", "RYE", "OTHER", "NOTSTUDENT"]
    if (req.body.hasOwnProperty("booking") && req.body.booking == "UTM") {
        booking = ["UTM"]
    }
    else if (req.body.hasOwnProperty("booking") && req.body.booking == "UOFT") {
        booking = ["UOFT"]
    }
    else if (req.body.hasOwnProperty("booking") && req.body.booking == "RYE") {
        booking = ["RYE"]
    }
    else if (req.body.hasOwnProperty("booking") && req.body.booking == "OTHER") {
        booking = ["OTHER"]
    }
    else if (req.body.hasOwnProperty("booking") && req.body.booking == "NOTSTUDENT") {
        booking = ["NOTSTUDENT"]
    }

    //Query
    db.collection(THERAPISTS_COLLECTION).find({
        "religion": {$in: religion},
        "lang": {$in: lang},
        "gender": {$in: gender},
        "income": {$in: income},
        "agegroup": {$in: agegroup},
        "institution": {$in: institution},
        "life": {$in: life}

    }).toArray(function (err, docs) {
        if (err) {
            handleError(res, err.message, "Failed to get therapists.");
        } else {
            res.status(200).json(docs);
        }
    });
});

app.post("/api/matchUsingScore", function (req, res) {

    let filter = {};

    //set filters
    switch(req.body.income){
        //  if < 40,000
        case "<$40,000":
            //  check if student
            switch(req.body.institution){
                case "RYE":
                case "UTM Undergrad":
                case "UTM Graduate":
                case "UOFT Undergrad":
                case "UOFT Graduate":
                case "SHERIDAN":
                //    filter.publicprograms = null   //  get ONLY private therapists
                break;
                default:
                    filter.publicprograms = "yes";  //  if NOT student, get ONLY public programs
                break;
            }
        break;
        case "$60,000-$100,000":
        case "$100,000+":
            filter.publicprograms = null;   //  get ONLY private therapists for income > 60,000
        break;
    }

    //  search THERAPIST_COLLECTION using filter
    db.collection(THERAPISTS_COLLECTION).find(filter).toArray(function (err, therapists) {
        if (err) {
            handleError(res, err.message, "Failed to get therapists.");
        } else {
            //  create new array using map
            let therapist_list = therapists.map(therapist =>
                //  weigh the relevance of therapist
                therapist_service.weighTherapist(therapist, req.body).then(therapistObj => {
                    return therapistObj;
                }).catch(err => console.log(err))
            );

            //  wait for array to finish
            Promise.all(therapist_list).then(arr => {
                arr.sort((a, b) => 
                    b.score - a.score);  //  sort array descending 
                let firstTen = arr.slice(0, 10)
                function shuffleArray() {
                    for (let i = firstTen.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [firstTen[i], firstTen[j]] = [firstTen[j], firstTen[i]];
                    }
                }
                shuffleArray()
                console.log(firstTen)
                firstTen.sort((a, b) => 
                Math.round(b.score) - Math.round(a.score)); 
                res.status(200).json(firstTen.slice(0, 10)); //  return first 10
            }).catch(err => console.log(err));
        }
    });
});

//  TODO:   Polish for matrices of different rows and column sizes. (Reusability)
app.get('/api/therapistMatrix', (req, res) => {

    db.collection(THERAPISTS_COLLECTION).find({}).toArray((err, therapists) => {
        if(err){
            handleError(res, err.message, "Failed to get therapists.");
        } else{

            let public = therapists.filter(e => e.publicprograms == "yes");
            let private = therapists.filter(e => e.publicprograms != "yes");

            therapist_service.createMatrix(public, private).then(data => {
                res.status(200).json(data); //  return first 10
            }).catch(err => console.log(err));
        }
    })
})