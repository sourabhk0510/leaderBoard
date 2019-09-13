const config = require('config.json');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('_helpers/db');
const User = db.User;
// var async = require('async'),
	 var _ = require('lodash');

module.exports = {
    authenticate,
    getAll,
    getById,
    create,
    update,
    delete: _delete,
    addScore,
    getStats
};

async function authenticate({ username, password }) {
    const user = await User.findOne({ username });
    if (user && bcrypt.compareSync(password, user.hash)) {
        const { hash, ...userWithoutHash } = user.toObject();
        const token = jwt.sign({ sub: user.id }, config.secret);
        return {
            ...userWithoutHash,
            token
        };
    }
}

async function getAll() {
    return await User.find().select('-hash');
}

async function getById(id) {
    return await User.findById(id).select('-hash');
}

async function create(userParam) {
    // validate
    if (await User.findOne({ username: userParam.username })) {
        throw 'Username "' + userParam.username + '" is already taken';
    }

    const user = new User(userParam);

    // hash password
    if (userParam.password) {
        user.hash = bcrypt.hashSync(userParam.password, 10);
    }
    
    // save user
    await user.save();
}

async function update(id, userParam) {
    const user = await User.findById(id);

    // validate
    if (!user) throw 'User not found';
    if (user.username !== userParam.username && await User.findOne({ username: userParam.username })) {
        throw 'Username "' + userParam.username + '" is already taken';
    }

    // hash password if it was entered
    if (userParam.password) {
        userParam.hash = bcrypt.hashSync(userParam.password, 10);
    }

    // copy userParam properties to user
    Object.assign(user, userParam);

    await user.save();
}

async function _delete(id) {
    await User.findByIdAndRemove(id);
}

async function addScore(id, userParam, callback) {
    var async = require('async')
    //  var user = await User.findById(id);
    // // validate
    // console.log("1", user.scores);
    // if (!user) throw 'User not found';
    // if(!user.hasOwnProperty('scores')){
    //     user.scores = [];
    // } else {
    //     user.scores.push(Object.assign(userParam, {'ts': Date.now()}));
    // }
    // console.log("2", user.scores);
    // await user.save();
    var toModify = {
        $set: {
            'scores': []
        }
    };
    async.waterfall([
        function(callback) {
            return User.find({_id: id}, {
                scores: 1
            }, function(err, res) {
                if (err || res === null)
                    return callback(err);
                else {
                    var scores = res[0].scores;
                    scores = _.without(scores, null);
                        if (!!userParam.name)
                            scores.push({
                                'name' : userParam.name,
                                'kills': userParam.kills,
                                'score': userParam.score,
                                'ts': Date.now()
                            });
                        else
                            return callback(new Error('error in params'));
                    toModify.$set.scores = scores;
                    return callback(null, toModify);
                }
            });
        },
        function(toModify, callback) {
            return User.updateOne({
                _id: id
            }, toModify, {}, function(err /*, res*/ ) {
                if (err)
                    return callback('DB_UPDATE_ERROR - ');
                return callback(null, 'successfull');
            });
        }
    ], callback);
}

async function getStats(match, time){
    
    var lowertlimit = Date.now() - (60*1000*(parseInt(time)))
   
    return await User.aggregate([
        {
            $match: {
                "scores.ts": {
                    $gte: lowertlimit,
                    $lte: Date.now()
                }
              }
        },
        {
            $project: {
                scores: {
                   $filter: {
                      input: "$scores",
                      as: "score",
                      cond: { $eq: [ "$$score.name", match ] }
                   }
                },
                _id: 0,
                username: 1
             }
        
        },
        { $unwind: "$scores" },
            {
                $sort : {"scores.score": -1}
            },
        {

            $project: {
                "scores.ts": 0,
                "scores.name": 0
             }
        }
    ]);
}
