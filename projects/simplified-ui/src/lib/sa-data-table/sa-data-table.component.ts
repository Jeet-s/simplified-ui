import { Component, OnInit, Input, ViewChild, Output, EventEmitter, AfterViewInit, SimpleChanges, OnChanges } from '@angular/core';
import { MatSort, MatPaginator } from '@angular/material';
import { SelectionModel } from '@angular/cdk/collections';
import { IDataTable, IRequestModel } from '../models/DataTableModel';
import { SaTableDataSource } from '../services/sa-table-data-source.service';
import { BehaviorSubject, Subscription, Observable } from 'rxjs';
import { DefaultCommonTableFilter, SaCommonTableFilter } from '../models/SaTableDataSource';
import { switchMap } from 'rxjs/operators';
import { IGenericPageListViewModel } from '../models/IPagerModel';
import { SaButton } from '../models/SaButton';
import { IDataFilterViewModel, IFilterModel } from '../models/DataFilterModels';



@Component({
  selector: 'sa-data-table',
  templateUrl: './sa-data-table.component.html',
  styleUrls: ['./sa-data-table.component.scss']
})
export class SaDataTableComponent<T> implements OnInit, AfterViewInit, OnChanges {

  @Input() dataTable: IDataTable<T>;
  @Output() rowClick = new EventEmitter<T>();

  public columnToDisplay: string[] = [];
  @ViewChild('iconSelector') iconSelector;
  filterArray: IDataFilterViewModel[] = [];

  /** list of paginated  rendered within the table */
  public get sourceList(): T[] { return this._source.value };
  public set sourceList(list) { this._source.next(list); }
  private _source = new BehaviorSubject<T[]>(null);
  public requestModel: IRequestModel = null;
  public baseUrl: string;
  public isRender: boolean = false;
  public showFilter: boolean = false;

  public tableDataSource = new SaTableDataSource(
    this._source.asObservable(),
    new DefaultCommonTableFilter(),
    false
  );


  subs: Subscription[] = [];

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  highlightedRows = [];
  totalCount: number;
  selection = new SelectionModel<T>(true, []);

  /** Whether the number of selected elements matches the total number of rows. */
  isAllSelected() {
    const numSelected = this.selection.selected.length;
    if (this.tableDataSource.dataStream != null) {
      return numSelected === this.tableDataSource.filter.pageSize;
    }
    return false;
  }

  /** Selects all rows if they are not all selected; otherwise clear selection. */
  masterToggle() {
    this.isAllSelected() ?
      this.selection.clear() :
      this.tableDataSource.dataStream.subscribe(row => row.forEach(r => this.selection.select(r)));
  }

  checkboxLabel(row?: T): string {
    if (!row) {
      return `${this.isAllSelected() ? 'select' : 'deselect'} all`;
    }
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row -`;
  }

  constructor() { }

  menuItemClicked(button: SaButton, evt) {
    button.triggerNext(evt);
  }

  ngOnInit() {

    this._setColumns();

    this.dataTable.columns.forEach(z => {
      if (z.filter != null)
        this.filterArray.push(z.filter);
    });

    this.tableDataSource = new SaTableDataSource(
      this._source.asObservable(),
      new DefaultCommonTableFilter(),
      false
    );

    // listen to dataSource filter change
    this.subs.push(this.tableDataSource.onFilterChange
      // here we return a new observable to get the new records on filter change using switchMap,
      // which also discards any pending subscription if a new filter change event is emitted
      // while the previous request hasn't been completed
      .pipe(switchMap(filter => this._getRecords(filter)))
      .subscribe(
        res => {
          this.totalCount = res.Pager.TotalRecords;
          this.sourceList = res.List;
          this.isRender = true;
          this.showFilter = true;
        },
        e => console.log(e)
      )
    );

    if (this.dataTable.showCheckboxColumn) {
      this.columnToDisplay.unshift('select');
    }

    if (this.dataTable.optionsMenu.length > 0) {
      this.columnToDisplay.push('options');
    }

    this.dataTable.dataSource.subscribe(x => {
      this._source.next([...[x], ...this._source.value]);
    })
  }

  ngOnChanges(changes: SimpleChanges){
    if (changes.dataTable){
      this._setColumns();
    }
  }

  ngAfterViewInit(): void {
    //attaching sort and paginator directives to the data source, after they are bound to the view
    this.tableDataSource.sort = this.sort;
    this.tableDataSource.paginator = this.paginator;
  }

  ngOnDestroy(): void {
    if (this.subs && this.subs.length > 0) {
      while (this.subs.length > 0) {
        let sub = this.subs.pop();
        sub.unsubscribe();
        sub = null;
      }
    }
    this._source.complete();
  }


  //* Callback for when table filter change is triggered.
  //  * Returns a new observable to fetch the new list of records using the updated filter model
  //* 
  //  * @param filter updated table filter model
  //* /
  private _getRecords(filter: SaCommonTableFilter): Observable<IGenericPageListViewModel<T>> {
    this.isRender = false;
    let requestModel: IRequestModel = {
      pageNumber: filter.pageNo,
      pageSize: filter.pageSize,
      sortDir: filter.sortDir,
      filter: filter.filterModel,
      sortCol: filter.sortCol
    }

    return this.dataTable.getResults(requestModel);
  }

  private _setColumns(){
    this.columnToDisplay = this.dataTable.columns.map(z => {
      return z.key;
    });
  }

  filterChange(filter: IFilterModel) {
    this.tableDataSource.filter.pageNo = 0;
    this.tableDataSource.filter.filterModel = filter;
  }

  dataRowClick(row: T) {
    this.dataTable.rowClick(row);
  }

  openSubMenuOptions() {
    this.iconSelector.open();
  }

}
