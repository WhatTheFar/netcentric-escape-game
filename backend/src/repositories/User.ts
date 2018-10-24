import { from, Observable, ObservableInput, of, SchedulerLike } from "rxjs";
import { map } from "rxjs/operators";
import { PlayerSocket } from "../controllers/socket/player";
import { IPlayerMessage } from "../model/player/PlayerMessage";
import Player from "../models/Player.model";
import { Crypto } from "./Crypto";
import { IFullToken, JWTAuth } from "./JWTAuth";
import { partialOf } from "./util/ObjectMapper";

export class User {

    public static addUser(
        nickname: string,
        email: string,
        password: string,
    ): Observable<Player> {
        const player = new Player({
            email, nickname, password: Crypto.encrypt(password),
        });
        return this.notifySocketFrom(player.save());
    }

    public static deleteUser(
        email: string,
    ): Observable<number> {
        return this.notifySocketFrom(Player.destroy({ where: { email } }));
    }

    public static edit(
        email: string,
        value: Partial<Player>,
    ): Observable<number> {
        return this.notifySocketFrom(Player.update(partialOf<Player>(value), { where: { email } })).pipe(
            map((result) => result[0]),
        );
    }

    public static list(): Observable<IPlayerMessage[]> {
        return Player.listPlayers();
    }

    public static login(
        email: string,
        password: string,
    ): Observable<IFullToken> {
        return from(Player.findOne({ where: { email } })).pipe(
            map((player) => {
                if (player) {
                    if (Crypto.equals(player.password, password)) {
                        return JWTAuth.getAllToken(email);
                    } else {
                        throw new Error("Email and password does not match");
                    }
                } else {
                    throw new Error(`Cannot find user with email: ${email}`);
                }
            }),
        );
    }

    public static findUser(
        token: string,
    ): Observable<Player | null> {
        try {
            const email = JWTAuth.decodeToken(token);
            if (email) {
                return from(Player.findOne({ where: { email } }));
            } else {
                return of(null);
            }
        } catch (error) {
            return of(null);
        }
    }

    private static updateUserList() {
        PlayerSocket.getInstance().updatePlayer(Player.listPlayers());
    }

    private static notifySocketFrom<T>(input: ObservableInput<T>, scheduler?: SchedulerLike): Observable<T> {
        return from(input, scheduler).pipe(
            map((result) => {
                this.updateUserList();
                return result;
            }),
        );
    }
}
