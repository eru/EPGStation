import * as m from 'mithril';
import * as apid from '../../../../api';
import { ViewModelStatus } from '../../Enums';
import DateUtil from '../../Util/DateUtil';
import Util from '../../Util/Util';
import BalloonViewModel from '../../ViewModel/Balloon/BalloonViewModel';
import MainLayoutViewModel from '../../ViewModel/MainLayoutViewModel';
import ProgramInfoViewModel from '../../ViewModel/Program/ProgramInfoViewModel';
import ReservesMenuViewModel from '../../ViewModel/Reserves/ReservesMenuViewModel';
import ReservesViewModel from '../../ViewModel/Reserves/ReservesViewModel';
import factory from '../../ViewModel/ViewModelFactory';
import { BalloonComponent } from '../BalloonComponent';
import MainLayoutComponent from '../MainLayoutComponent';
import PaginationComponent from '../PaginationComponent';
import ParentComponent from '../ParentComponent';
import ProgramInfoComponent from '../Program/ProgramInfoComponent';
import ReservesDeleteComponent from './ReservesDeleteComponent';
import ReservesMenuComponent from './ReservesMenuComponent';

/**
 * ReservesComponent
 */
class ReservesComponent extends ParentComponent<void> {
    private viewModel: ReservesViewModel;
    private mainLayoutViewModel: MainLayoutViewModel;
    private menuViewModel: ReservesMenuViewModel;
    private balloon: BalloonViewModel;
    private programInfo: ProgramInfoViewModel;

    constructor() {
        super();
        this.viewModel = <ReservesViewModel> factory.get('ReservesViewModel');
        this.mainLayoutViewModel = <MainLayoutViewModel> factory.get('MainLayoutViewModel');
        this.menuViewModel = <ReservesMenuViewModel> factory.get('ReservesMenuViewModel');
        this.balloon = <BalloonViewModel> factory.get('BalloonViewModel');
        this.programInfo = <ProgramInfoViewModel> factory.get('ProgramInfoViewModel');
    }

    protected initViewModel(status: ViewModelStatus = 'init'): void {
        super.initViewModel(status);

        this.mainLayoutViewModel.init(status);

        this.viewModel.init(status).
        then(() => {
            this.setRestorePositionFlag(status);
            this.mainLayoutViewModel.update();
        });
    }

    /**
     * page name
     */
    protected getComponentName(): string { return 'Reserves'; }

    /**
     * view
     */
    public view(): m.Child {
        return m(MainLayoutComponent, {
            header: { title: m.route.param('mode') === 'conflicts' ? '重複' : '予約' },
            menuContent: [
                {
                    attrs: {
                        onclick: () => {
                            this.balloon.close();
                            setTimeout(() => {
                                this.viewModel.startUpdateReserves();
                            }, 200);
                        },
                    },
                    text: '予約情報更新',
                },
            ],
            content: [
                this.createContent(),
            ],
            scrollStoped: (scrollTop: number) => {
                this.saveHistoryData(scrollTop);
            },
            notMainContent: [
                m(BalloonComponent, {
                    id: ProgramInfoViewModel.id,
                    content: m(ProgramInfoComponent),
                    maxWidth: 450,
                    maxHeight: 450,
                    dialogMaxWidth: 600,
                    verticalOnly: window.innerWidth <= ReservesComponent.switchingWidth,
                    forceDialog: window.innerHeight < 900 && window.innerWidth < 780,
                }),
                m(BalloonComponent, {
                    id: ReservesMenuViewModel.id,
                    content: m(ReservesMenuComponent),
                    maxWidth: 94,
                    horizontalOnly: true,
                }),
                m(BalloonComponent, {
                    id: ReservesMenuViewModel.deleteId,
                    content: m(ReservesDeleteComponent),
                    maxWidth: 300,
                    forceDialog: true,
                }),
            ],
        });
    }

    /**
     * content
     * @return m.Child
     */
    private createContent(): m.Child {
        return m('div', {
            class: 'reserves',
            onupdate: () => { this.restoreMainLayoutPosition(); },
        } , [
            this.createCardView(),
            this.createTableView(),
            m(PaginationComponent, {
                total: this.viewModel.getReserves().total,
                length: this.viewModel.getLimit(),
                page: typeof m.route.param('page') === 'undefined' ? 1 : Number(m.route.param('page')),
            }),
        ]);
    }

    /**
     * create card content
     * @return m.Child[]
     */
    private createCardView(): m.Child[] {
        return this.viewModel.getReserves().reserves.map((reserve) => {
            return m('div', { class: 'reserves-card mdl-card mdl-shadow--2dp mdl-cell mdl-cell--12-col' }, [
                m('button', {
                    class: 'mdl-button mdl-js-button mdl-button--icon',
                    style: 'position: absolute; right: 0px;',
                    onclick: (e: Event) => {
                        this.menuViewModel.set(reserve);
                        this.balloon.open(ReservesMenuViewModel.id, e);
                    },
                }, [
                    m('i', { class: 'material-icons' }, 'more_vert'), // menu icon
                ]),
                // 番組情報
                m('div', {
                    class: 'mdl-card__supporting-text',
                    onclick: (event: Event) => { this.openProgramInfo(event, reserve); },
                }, [
                    m('div', { class: 'title' }, reserve.program.name),
                    m('div', { class: 'time' }, this.getCardTime(reserve.program)),
                    m('div', { class: 'channel' }, this.viewModel.getChannelName(reserve.program.channelId)),
                    m('div', { class: 'description' }, reserve.program.description),
                ]),
            ]);
        });
    }

    /**
     * click 時に programInfo を開く
     * @param event: Event
     * @param reserve: reserve
     */
    private openProgramInfo(event: Event, reserve: apid.Reserve): void {
        const channel = this.viewModel.getChannel(reserve.program.channelId);
        if (channel === null) { return; }

        this.programInfo.set(reserve.program, channel);
        this.balloon.open(ProgramInfoViewModel.id, event);
    }

    /**
     * getCardTime
     * @return string
     */
    private getCardTime(program: apid.ReserveProgram): string {
        const start = DateUtil.getJaDate(new Date(program.startAt));
        const end = DateUtil.getJaDate(new Date(program.endAt));
        const duration = Math.floor((program.endAt - program.startAt) / 1000 / 60);

        return DateUtil.format(start, 'MM/dd(w) hh:mm:ss') + '~' + DateUtil.format(end, 'hh:mm:ss') + `(${ duration }分)`;
    }

    /**
     * create table content
     * @return m.Child
     */
    private createTableView(): m.Child {
        return m('table', {
            class: 'mdl-data-table mdl-js-data-table mdl-shadow--2dp',
            style: this.viewModel.getReserves().reserves.length === 0 ? 'display: none;' : '',
        }, [
            m('thead', m('tr', [
                m('th', { class: ReservesComponent.nonNumeric }, '放送局'),
                m('th', { class: ReservesComponent.nonNumeric }, '日付'),
                m('th', { class: ReservesComponent.nonNumeric }, '録画時間'),
                m('th', { class: ReservesComponent.nonNumeric }, 'タイトル'),
                m('th', { class: ReservesComponent.nonNumeric }, '内容'),
                m('th', { class: ReservesComponent.nonNumeric }, ''), // option
            ])),
            m('tbody', this.viewModel.getReserves().reserves.map((reserve) => {
                return m('tr', [
                    m('td', { class: ReservesComponent.nonNumeric + ' channel' }, this.viewModel.getChannelName(reserve.program.channelId)),
                    m('td', {
                        class: ReservesComponent.nonNumeric + ' day',
                        onclick: () => {
                            const start = DateUtil.getJaDate(new Date(reserve.program.startAt));
                            Util.move('/program', {
                                ch: reserve.program.channelId,
                                time: DateUtil.format(start, 'YYMMddhh'),
                            });
                        },
                    }, this.getDayTime(reserve.program)),
                    this.getDurationItem(reserve.program),
                    m('td', {
                        class: ReservesComponent.nonNumeric + ' title',
                        onclick: (event: Event) => { this.openProgramInfo(event, reserve); },
                    }, reserve.program.name),
                    m('td', {
                        class: ReservesComponent.nonNumeric + ' description',
                        onclick: (event: Event) => { this.openProgramInfo(event, reserve); },
                    }, reserve.program.description),
                    this.createTableOption(reserve),
                ]);
            })),
        ]);
    }

    /**
     * getDurationItem
     * @return m.Child
     */
    private getDurationItem(program: apid.ReserveProgram): m.Child {
        const times = this.getTimes(program);

        return m('td', {
            class: ReservesComponent.nonNumeric + ' duration',
            onclick: () => {
                const start = DateUtil.getJaDate(new Date(program.startAt));
                Util.move('/program', {
                    type: program.channelType,
                    time: DateUtil.format(start, 'YYMMddhh'),
                });
            },
        }, [
            `${ times.start } ~ ${ times.end }`,
            m('div', times.duration),
        ]);
    }

    /**
     * getTableDayTime
     * @return string
     */
    private getDayTime(program: apid.ReserveProgram): string {
        const start = DateUtil.getJaDate(new Date(program.startAt));

        return DateUtil.format(start, 'MM/dd(w)');
    }

    /**
     * getTimes
     * @return string
     */
    private getTimes(program: apid.ReserveProgram): { start: string; end: string; duration: string } {
        const start = DateUtil.getJaDate(new Date(program.startAt));
        const end = DateUtil.getJaDate(new Date(program.endAt));
        const duration = Math.floor((program.endAt - program.startAt) / 1000 / 60);

        return {
            start: DateUtil.format(start, 'hh:mm:ss'),
            end: DateUtil.format(end, 'hh:mm:ss'),
            duration: `(${ duration }分)`,
        };
    }

    private createTableOption(reserve: apid.Reserve): m.Child {
        return m('td', { class: ReservesComponent.nonNumeric + ' option' }, [
            m('div', { class: 'option-container' }, [
                // edit rule
                m('button', {
                    class: 'mdl-button mdl-js-button mdl-button--icon',
                    style: typeof reserve.ruleId === 'undefined' ? 'visibility: hidden;' : '',
                    onclick: () => { Util.move('/search', { rule: reserve.ruleId }); },
                },
                    m('i', { class: 'material-icons' }, 'mode_edit'),
                ),
                // delete
                m('button', {
                    class: 'mdl-button mdl-js-button mdl-button--icon',
                    onclick: () => {
                        this.menuViewModel.set(reserve);
                        this.menuViewModel.openDelete();
                    },
                },
                    m('i', { class: 'material-icons' }, 'delete'),
                ),
            ]),
        ]);
    }
}

namespace ReservesComponent {
    export const nonNumeric = 'mdl-data-table__cell--non-numeric';
    export const switchingWidth = 780;
}

export default ReservesComponent;

