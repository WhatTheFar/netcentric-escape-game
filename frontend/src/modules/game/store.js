import { observable, action, autorun, computed } from 'mobx'
import LoginService from "../../services/login-service";
import RoomStore from "../waitingRoom/store"
import { WEBSOCKET_URL } from "../../env";
import GameService from "../../services/game-service";
import Axios from "../../axiosConfig"

class GameStore {

    @observable
    gameData = [];

    @observable
    gameDetail = {
        block: [],
        dimension: {
            x: 5,
            y: 5,
        },
        playerIndex: -1,
        time: 0,
        playersInfo: []
    };

    @observable
    winner;

    @observable
    nextGame = true;

    @observable
    shouldLoadingModalShow = true;

    @observable
    scores = [];

    keyPad = ['Up','Left','Down','Right']

    gameSocket;
    disposer;

    init() {
        this.disposer = autorun(() => {
            if(RoomStore.selectedRoomToken && LoginService.token) {
                this.connectGameSocket();
            }
        });
    }

    dispose() {
        this.disposer();
    }

    connectGameSocket() {
        if(!this.gameSocket)  {
            this.gameSocket = new WebSocket(`${WEBSOCKET_URL}/game?player=${LoginService.token}&token=${RoomStore.selectedRoomToken}`);
            this.gameSocket.onmessage = ({data}) => {
                this.setGameDetail(JSON.parse(data));
                
            };
            this.gameSocket.onclose = ({code}) => {
                if(code === 1006) { 
                    this.gameSocket = null;
                    setTimeout(() => {
                        this.connectGameSocket()
                    }, 10000);
                }
            };
        }
    }
    

    @computed
    get gameTable() {
        const table = [];
        for(let i = 0; i < this.gameDetail.dimension.x; i++) {
            const temp = [];
            for(let j = 0; j < this.gameDetail.dimension.y; j++){
                let node;
                let playerNode;
                if(this.gameDetail.blocks) {
                    node = this.gameDetail.blocks.find((o) => o.coordinate.x === i && o.coordinate.y === j);
                }
                if(this.gameDetail.playersInfo){
                    playerNode = this.gameDetail.playersInfo.find((o) => {
                        if(o.coordinate) {
                            return o.coordinate.x === i && o.coordinate.y === j
                        } else {
                            return false;
                        }
                    });
                }
                if(node) {
                    switch(node.blockType){
                        case "OBSTACLE":
                            temp.push("https://www.img.in.th/images/5328946b24463775ee939c0b4aa7c29e.png");
                            break;
                        case "TUNNEL":
                            temp.push( "https://www.img.in.th/images/ad99cc78058995b1a843f1fc01300490.png");
                            break;
                    }
                } else if(playerNode) {
                    switch(playerNode.playerType){
                        case "PRISONER":
                            temp.push("https://www.img.in.th/images/ba4f58903464055c58cff60f6eaeac14.png");
                            break;
                        case "WARDER":
                            temp.push("https://www.img.in.th/images/d2fa8efb16948bb1fdf72860f3c50e42.png");
                            break;
                    }
                } else{
                    temp.push("blank");
                }
            }
            table.push(temp);
        }
        return table;
    }

    @computed
    get time() {
        return 10-this.gameDetail.time;
    }

    @computed
    get turn() {
        if(this.gameDetail.playerIndex!==-1){
            return this.gameDetail.playersInfo[this.gameDetail.playerIndex].token===LoginService.token;
        }else {
            return false;
        }
    }

    @computed
    get endGame() {
        if(this.gameDetail.playerIndex!==-1){
            this.getScores();
            return this.gameDetail.playersInfo.findIndex(o => o.isWin) !== -1;
        }else {
            return false;
        }
    }

    @computed
    get role() {
        if (this.gameDetail.playersInfo) {
            const player = this.gameDetail.playersInfo.find((o)=> o.token === LoginService.token);
            return (player)?player.playerType:"";
        }
        return "";
    }
    

    @action.bound
    dismissLoadingModal() {
        this.shouldLoadingModalShow = false;
    }

    @action.bound
    async setGameDetail(gameDetail) {
        this.gameDetail = gameDetail;
        if(gameDetail.playerIndex !== -1) {
            this.shouldLoadingModalShow = false;            
        }
    }
    
    @action.bound
    sendMove(direction) {
        if(this.gameSocket) {
            this.gameSocket.send(JSON.stringify({direction}))
        }
    }

    @computed
    get winnerName(){
        return (this.gameDetail.playersInfo.find(o => o.isWin)) ? this.gameDetail.playersInfo.find(o => o.isWin).name : "";
    }


    @action.bound
    onChange(key, value) {
        this[key] = value;
    }

    @action.bound
    setScores(scores){
        this.scores = scores;
    }

    
    async getScores(){
        const response = await Promise.all(this.gameDetail.playersInfo.map((player)=> Axios({
                method: 'get',
                url: `/winStat/${player.token}`,
            })
        ));
        this.setScores(response.map(o => o.data) || []);
    }
    
    async playAgain(){
        await Axios({
            method: 'post',
            url: `/resetGame/`,
            data: {token:RoomStore.selectedRoomToken}
        })
    }
    
}

export default new GameStore();
